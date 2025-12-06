import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { TerminalManager } from "./terminal-manager";
import { GhosttyManager } from "./ghostty-manager";
import type { GhosttyBackend, WebServerConfig } from "./types";

// Web server instance (started on demand via dynamic import)
// Requires Bun runtime - will fail gracefully if Bun is not available
let webServer: { start(): void; stop(): void; port: number; host: string } | null = null;

async function createWebServer(config: WebServerConfig): Promise<typeof webServer> {
  try {
    // Dynamic import to avoid loading Bun-specific code in Node.js
    const { TermMcpWebServer } = await import("./web-server");
    return new TermMcpWebServer(config);
  } catch (error) {
    throw new Error(
      "Web server requires Bun runtime. Please run with: bun run start:web\n" +
      `Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Tool schemas
const SpawnTerminalSchema = z.object({
  shell: z.string().optional().describe("Shell to use (default: user's shell or /bin/bash)"),
  cwd: z.string().optional().describe("Working directory for the terminal"),
  env: z.record(z.string()).optional().describe("Additional environment variables to set"),
  cols: z.number().optional().describe("Terminal columns (default: 80)"),
  rows: z.number().optional().describe("Terminal rows (default: 24)"),
  visible: z.boolean().optional().describe("If true, creates a visible tmux session. Attach with: tmux attach -t <sessionName>"),
});

const SendInputSchema = z.object({
  sessionId: z.string().describe("Terminal session ID"),
  input: z.string().describe("Input to send to the terminal. Use \\n for newline, \\t for tab."),
});

const ReadOutputSchema = z.object({
  sessionId: z.string().describe("Terminal session ID"),
  lines: z.number().optional().describe("Number of recent lines to return (default: all)"),
  clear: z.boolean().optional().describe("Clear the buffer after reading (default: false)"),
});

const RunCommandSchema = z.object({
  sessionId: z.string().describe("Terminal session ID"),
  command: z.string().describe("Command to execute"),
  timeout: z.number().optional().describe("Timeout in milliseconds (default: 30000)"),
  waitFor: z.string().optional().describe("Pattern to wait for indicating command completion"),
});

const WaitForPatternSchema = z.object({
  sessionId: z.string().describe("Terminal session ID"),
  pattern: z.string().describe("Regular expression pattern to wait for in the terminal output"),
  timeout: z.number().optional().describe("Timeout in milliseconds (default: 30000)"),
  clear: z.boolean().optional().describe("Clear the buffer after the pattern is matched (default: false)"),
});

const CloseTerminalSchema = z.object({
  sessionId: z.string().describe("Terminal session ID to close"),
});

const OpenWindowSchema = z.object({
  sessionId: z.string().describe("Terminal session ID to open window for"),
});

// Ghostty-specific schemas
const GhosttySpawnSchema = z.object({
  backend: z.enum(["pty", "native", "web"]).optional().describe("Backend to use: 'pty' (headless), 'native' (Ghostty window), 'web' (browser)"),
  shell: z.string().optional().describe("Shell to use (default: user's shell or /bin/bash)"),
  cwd: z.string().optional().describe("Working directory for the terminal"),
  env: z.record(z.string()).optional().describe("Additional environment variables to set"),
  cols: z.number().optional().describe("Terminal columns (default: 80)"),
  rows: z.number().optional().describe("Terminal rows (default: 24)"),
  title: z.string().optional().describe("Window title (for native backend)"),
  fontSize: z.number().optional().describe("Font size (default: 14)"),
});

const GhosttyInputSchema = z.object({
  sessionId: z.string().describe("Ghostty session ID"),
  input: z.string().describe("Input to send to the terminal. Use \\n for newline, \\t for tab."),
});

const GhosttyReadSchema = z.object({
  sessionId: z.string().describe("Ghostty session ID"),
  lines: z.number().optional().describe("Number of recent lines to return (default: all)"),
  clear: z.boolean().optional().describe("Clear the buffer after reading (default: false)"),
});

const GhosttyCommandSchema = z.object({
  sessionId: z.string().describe("Ghostty session ID"),
  command: z.string().describe("Command to execute"),
  timeout: z.number().optional().describe("Timeout in milliseconds (default: 30000)"),
  waitFor: z.string().optional().describe("Pattern to wait for indicating command completion"),
});

const GhosttyWaitSchema = z.object({
  sessionId: z.string().describe("Ghostty session ID"),
  pattern: z.string().describe("Regular expression pattern to wait for in the terminal output"),
  timeout: z.number().optional().describe("Timeout in milliseconds (default: 30000)"),
  clear: z.boolean().optional().describe("Clear the buffer after the pattern is matched (default: false)"),
});

const GhosttyCloseSchema = z.object({
  sessionId: z.string().describe("Ghostty session ID to close"),
});

const StartWebServerSchema = z.object({
  port: z.number().optional().describe("Port to listen on (default: 3000)"),
  host: z.string().optional().describe("Host to bind to (default: localhost)"),
});

// Helper to strip ANSI escape codes
function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/\x1b\][^\x07]*\x07/g, "");
}

// Create MCP server
const server = new Server(
  {
    name: "term-mcp",
    version: "0.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "spawn-terminal",
        description:
          "Spawn a new terminal session. Returns a session ID that must be used for all subsequent operations. Set visible=true to create a tmux session you can attach to with 'tmux attach -t <name>'.",
        inputSchema: {
          type: "object",
          properties: {
            shell: { type: "string", description: "Shell to use (default: user's shell or /bin/bash)" },
            cwd: { type: "string", description: "Working directory for the terminal" },
            env: {
              type: "object",
              additionalProperties: { type: "string" },
              description: "Additional environment variables to set",
            },
            cols: { type: "number", description: "Terminal columns (default: 80)" },
            rows: { type: "number", description: "Terminal rows (default: 24)" },
            visible: {
              type: "boolean",
              description: "If true, creates a visible tmux session. User can attach with: tmux attach -t <sessionName>"
            },
          },
        },
      },
      {
        name: "send-input",
        description:
          "Send input to a terminal session. Use this for interactive programs or when you need fine-grained control.",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Terminal session ID" },
            input: {
              type: "string",
              description: "Input to send to the terminal. Use \\n for newline, \\t for tab.",
            },
          },
          required: ["sessionId", "input"],
        },
      },
      {
        name: "read-output",
        description:
          "Read the current output buffer from a terminal session. Returns all output since the last clear.",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Terminal session ID" },
            lines: { type: "number", description: "Number of recent lines to return (default: all)" },
            clear: { type: "boolean", description: "Clear the buffer after reading (default: false)" },
          },
          required: ["sessionId"],
        },
      },
      {
        name: "run-command",
        description:
          "Execute a command in a terminal session and wait for it to complete. Returns the command output.",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Terminal session ID" },
            command: { type: "string", description: "Command to execute" },
            timeout: { type: "number", description: "Timeout in milliseconds (default: 30000)" },
            waitFor: { type: "string", description: "Pattern to wait for indicating command completion" },
          },
          required: ["sessionId", "command"],
        },
      },
      {
        name: "wait-for-pattern",
        description:
          "Wait for a specific pattern to appear in the terminal output. Useful for waiting for prompts or specific output.",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Terminal session ID" },
            pattern: { type: "string", description: "Regular expression pattern to wait for" },
            timeout: { type: "number", description: "Timeout in milliseconds (default: 30000)" },
            clear: { type: "boolean", description: "Clear the buffer after match (default: false)" },
          },
          required: ["sessionId", "pattern"],
        },
      },
      {
        name: "list-sessions",
        description: "List all active terminal sessions.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "close-terminal",
        description: "Close a terminal session and clean up resources.",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Terminal session ID to close" },
          },
          required: ["sessionId"],
        },
      },
      {
        name: "open-terminal-window",
        description: "Open or reopen a terminal emulator window for a visible (tmux) session. Use this if the window was closed or failed to spawn.",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Terminal session ID to open window for" },
          },
          required: ["sessionId"],
        },
      },
      // Ghostty tools
      {
        name: "ghostty-spawn",
        description:
          "Spawn a new Ghostty terminal session with backend selection. Supports 'pty' (headless), 'native' (Ghostty window), or 'web' (browser-based).",
        inputSchema: {
          type: "object",
          properties: {
            backend: {
              type: "string",
              enum: ["pty", "native", "web"],
              description: "Backend to use: 'pty' (headless), 'native' (Ghostty window), 'web' (browser)",
            },
            shell: { type: "string", description: "Shell to use (default: user's shell or /bin/bash)" },
            cwd: { type: "string", description: "Working directory for the terminal" },
            env: {
              type: "object",
              additionalProperties: { type: "string" },
              description: "Additional environment variables to set",
            },
            cols: { type: "number", description: "Terminal columns (default: 80)" },
            rows: { type: "number", description: "Terminal rows (default: 24)" },
            title: { type: "string", description: "Window title (for native backend)" },
            fontSize: { type: "number", description: "Font size (default: 14)" },
          },
        },
      },
      {
        name: "ghostty-send-input",
        description: "Send input to a Ghostty terminal session.",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Ghostty session ID" },
            input: { type: "string", description: "Input to send. Use \\n for newline, \\t for tab." },
          },
          required: ["sessionId", "input"],
        },
      },
      {
        name: "ghostty-read-output",
        description: "Read the current output buffer from a Ghostty terminal session.",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Ghostty session ID" },
            lines: { type: "number", description: "Number of recent lines to return (default: all)" },
            clear: { type: "boolean", description: "Clear the buffer after reading (default: false)" },
          },
          required: ["sessionId"],
        },
      },
      {
        name: "ghostty-run-command",
        description: "Execute a command in a Ghostty terminal session and wait for completion.",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Ghostty session ID" },
            command: { type: "string", description: "Command to execute" },
            timeout: { type: "number", description: "Timeout in milliseconds (default: 30000)" },
            waitFor: { type: "string", description: "Pattern to wait for indicating command completion" },
          },
          required: ["sessionId", "command"],
        },
      },
      {
        name: "ghostty-wait-for-pattern",
        description: "Wait for a specific pattern to appear in Ghostty terminal output.",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Ghostty session ID" },
            pattern: { type: "string", description: "Regular expression pattern to wait for" },
            timeout: { type: "number", description: "Timeout in milliseconds (default: 30000)" },
            clear: { type: "boolean", description: "Clear the buffer after match (default: false)" },
          },
          required: ["sessionId", "pattern"],
        },
      },
      {
        name: "ghostty-list-sessions",
        description: "List all active Ghostty terminal sessions with backend information.",
        inputSchema: {
          type: "object",
          properties: {
            backend: {
              type: "string",
              enum: ["pty", "native", "web"],
              description: "Filter sessions by backend type (optional)",
            },
          },
        },
      },
      {
        name: "ghostty-close",
        description: "Close a Ghostty terminal session and clean up resources.",
        inputSchema: {
          type: "object",
          properties: {
            sessionId: { type: "string", description: "Ghostty session ID to close" },
          },
          required: ["sessionId"],
        },
      },
      {
        name: "ghostty-get-backends",
        description: "Get list of available Ghostty backends (pty, native, web). Native requires Ghostty to be installed.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "start-web-server",
        description: "Start the web server for browser-based terminal access. Returns the URL to access terminals.",
        inputSchema: {
          type: "object",
          properties: {
            port: { type: "number", description: "Port to listen on (default: 3000)" },
            host: { type: "string", description: "Host to bind to (default: localhost)" },
          },
        },
      },
      {
        name: "stop-web-server",
        description: "Stop the web server for browser-based terminal access.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "spawn-terminal": {
        const parsed = SpawnTerminalSchema.parse(args);
        const session = TerminalManager.spawn({
          shell: parsed.shell,
          cwd: parsed.cwd,
          env: parsed.env,
          cols: parsed.cols,
          rows: parsed.rows,
          visible: parsed.visible,
        });

        // Wait a moment for the shell to initialize
        await new Promise((resolve) => setTimeout(resolve, 200));

        const info = session.getInfo();
        const response: Record<string, unknown> = {
          sessionId: session.id,
          cwd: session.cwd,
          visible: !!parsed.visible,
        };

        if (info.visible && info.attachCommand) {
          response.tmuxSession = info.tmuxSession;
          response.attachCommand = info.attachCommand;
          response.message = `Visible terminal session created. Attach with: ${info.attachCommand}`;
        } else {
          response.pid = info.pid;
          response.message = `Terminal session ${session.id} spawned successfully (headless).`;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response),
            },
          ],
        };
      }

      case "send-input": {
        const parsed = SendInputSchema.parse(args);
        const session = TerminalManager.getOrThrow(parsed.sessionId);

        // Process escape sequences
        const processedInput = parsed.input
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\x1b/g, "\x1b")
          .replace(/\\u001b/g, "\x1b");

        session.write(processedInput);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Sent ${processedInput.length} characters to session ${parsed.sessionId}`,
              }),
            },
          ],
        };
      }

      case "read-output": {
        const parsed = ReadOutputSchema.parse(args);
        const session = TerminalManager.getOrThrow(parsed.sessionId);

        const output = session.read({ lines: parsed.lines, clear: parsed.clear });
        const cleanOutput = stripAnsi(output);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                output: cleanOutput,
                rawOutput: output,
                length: output.length,
                sessionId: parsed.sessionId,
              }),
            },
          ],
        };
      }

      case "run-command": {
        const parsed = RunCommandSchema.parse(args);
        const session = TerminalManager.getOrThrow(parsed.sessionId);

        const result = await session.runCommand(parsed.command, {
          timeout: parsed.timeout,
          waitFor: parsed.waitFor ? new RegExp(parsed.waitFor) : undefined,
        });

        const cleanOutput = stripAnsi(result.output);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                output: cleanOutput,
                rawOutput: result.output,
                completed: result.completed,
                sessionId: parsed.sessionId,
                command: parsed.command,
              }),
            },
          ],
        };
      }

      case "wait-for-pattern": {
        const parsed = WaitForPatternSchema.parse(args);
        const session = TerminalManager.getOrThrow(parsed.sessionId);

        try {
          const output = await session.waitFor(new RegExp(parsed.pattern), {
            timeout: parsed.timeout ?? 30000,
            clear: parsed.clear ?? false,
          });

          const cleanOutput = stripAnsi(output);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  matched: true,
                  output: cleanOutput,
                  rawOutput: output,
                  pattern: parsed.pattern,
                  sessionId: parsed.sessionId,
                }),
              },
            ],
          };
        } catch (error) {
          const currentOutput = session.read();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  matched: false,
                  output: stripAnsi(currentOutput),
                  rawOutput: currentOutput,
                  pattern: parsed.pattern,
                  sessionId: parsed.sessionId,
                  error: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
          };
        }
      }

      case "list-sessions": {
        const sessions = TerminalManager.list();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                sessions: sessions.map((s) => ({
                  sessionId: s.id,
                  pid: s.pid,
                  cwd: s.cwd,
                  createdAt: s.createdAt.toISOString(),
                  alive: s.alive,
                  visible: s.visible || false,
                  tmuxSession: s.tmuxSession,
                  attachCommand: s.attachCommand,
                })),
                count: sessions.length,
              }),
            },
          ],
        };
      }

      case "close-terminal": {
        const parsed = CloseTerminalSchema.parse(args);
        const destroyed = TerminalManager.destroy(parsed.sessionId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: destroyed,
                message: destroyed
                  ? `Session ${parsed.sessionId} closed successfully`
                  : `Session ${parsed.sessionId} not found`,
                sessionId: parsed.sessionId,
              }),
            },
          ],
        };
      }

      case "open-terminal-window": {
        const parsed = OpenWindowSchema.parse(args);
        const session = TerminalManager.getOrThrow(parsed.sessionId);
        const info = session.getInfo();

        if (!info.visible) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  message: `Session ${parsed.sessionId} is not a visible (tmux) session`,
                  sessionId: parsed.sessionId,
                }),
              },
            ],
          };
        }

        if (!session.openWindow) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  message: `Session ${parsed.sessionId} does not support opening windows`,
                  sessionId: parsed.sessionId,
                }),
              },
            ],
          };
        }

        session.openWindow();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Terminal window opened for session ${parsed.sessionId}`,
                sessionId: parsed.sessionId,
                attachCommand: info.attachCommand,
              }),
            },
          ],
        };
      }

      // Ghostty tools
      case "ghostty-spawn": {
        const parsed = GhosttySpawnSchema.parse(args);
        const session = GhosttyManager.spawn({
          backend: (parsed.backend as GhosttyBackend) || "pty",
          shell: parsed.shell,
          cwd: parsed.cwd,
          env: parsed.env,
          cols: parsed.cols,
          rows: parsed.rows,
          title: parsed.title,
          fontSize: parsed.fontSize,
        });

        // Wait for shell to initialize
        await new Promise((resolve) => setTimeout(resolve, 200));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                sessionId: session.id,
                pid: session.pid,
                cwd: session.cwd,
                backend: session.backend,
                webUrl: session.webUrl,
                windowId: session.windowId,
                message: `Ghostty session ${session.id} spawned with ${session.backend} backend.`,
              }),
            },
          ],
        };
      }

      case "ghostty-send-input": {
        const parsed = GhosttyInputSchema.parse(args);
        const session = GhosttyManager.getOrThrow(parsed.sessionId);

        const processedInput = parsed.input
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\x1b/g, "\x1b")
          .replace(/\\u001b/g, "\x1b");

        session.write(processedInput);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Sent ${processedInput.length} characters to session ${parsed.sessionId}`,
              }),
            },
          ],
        };
      }

      case "ghostty-read-output": {
        const parsed = GhosttyReadSchema.parse(args);
        const session = GhosttyManager.getOrThrow(parsed.sessionId);

        const output = session.read({ lines: parsed.lines, clear: parsed.clear });
        const cleanOutput = stripAnsi(output);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                output: cleanOutput,
                rawOutput: output,
                length: output.length,
                sessionId: parsed.sessionId,
                backend: session.backend,
              }),
            },
          ],
        };
      }

      case "ghostty-run-command": {
        const parsed = GhosttyCommandSchema.parse(args);
        const session = GhosttyManager.getOrThrow(parsed.sessionId);

        const result = await session.runCommand(parsed.command, {
          timeout: parsed.timeout,
          waitFor: parsed.waitFor ? new RegExp(parsed.waitFor) : undefined,
        });

        const cleanOutput = stripAnsi(result.output);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                output: cleanOutput,
                rawOutput: result.output,
                completed: result.completed,
                sessionId: parsed.sessionId,
                command: parsed.command,
              }),
            },
          ],
        };
      }

      case "ghostty-wait-for-pattern": {
        const parsed = GhosttyWaitSchema.parse(args);
        const session = GhosttyManager.getOrThrow(parsed.sessionId);

        try {
          const output = await session.waitFor(new RegExp(parsed.pattern), {
            timeout: parsed.timeout ?? 30000,
            clear: parsed.clear ?? false,
          });

          const cleanOutput = stripAnsi(output);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  matched: true,
                  output: cleanOutput,
                  rawOutput: output,
                  pattern: parsed.pattern,
                  sessionId: parsed.sessionId,
                }),
              },
            ],
          };
        } catch (error) {
          const currentOutput = session.read();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  matched: false,
                  output: stripAnsi(currentOutput),
                  rawOutput: currentOutput,
                  pattern: parsed.pattern,
                  sessionId: parsed.sessionId,
                  error: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
          };
        }
      }

      case "ghostty-list-sessions": {
        const parsed = args as { backend?: GhosttyBackend };
        const sessions = parsed.backend
          ? GhosttyManager.listByBackend(parsed.backend)
          : GhosttyManager.list();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                sessions: sessions.map((s) => ({
                  sessionId: s.id,
                  pid: s.pid,
                  cwd: s.cwd,
                  createdAt: s.createdAt.toISOString(),
                  alive: s.alive,
                  backend: s.backend,
                  webUrl: s.webUrl,
                  windowId: s.windowId,
                })),
                count: sessions.length,
              }),
            },
          ],
        };
      }

      case "ghostty-close": {
        const parsed = GhosttyCloseSchema.parse(args);
        const destroyed = GhosttyManager.destroy(parsed.sessionId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: destroyed,
                message: destroyed
                  ? `Ghostty session ${parsed.sessionId} closed successfully`
                  : `Session ${parsed.sessionId} not found`,
                sessionId: parsed.sessionId,
              }),
            },
          ],
        };
      }

      case "ghostty-get-backends": {
        const backends = GhosttyManager.getAvailableBackends();
        const ghosttyAvailable = GhosttyManager.isGhosttyAvailable();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                backends,
                ghosttyInstalled: ghosttyAvailable,
                message: ghosttyAvailable
                  ? "Ghostty is installed. All backends available."
                  : "Ghostty not installed. Native backend unavailable.",
              }),
            },
          ],
        };
      }

      case "start-web-server": {
        const parsed = StartWebServerSchema.parse(args);

        if (webServer) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  message: "Web server is already running",
                  url: `http://${webServer.host}:${webServer.port}`,
                }),
              },
            ],
          };
        }

        // Dynamic import to support both Node.js and Bun runtimes
        webServer = await createWebServer({
          port: parsed.port,
          host: parsed.host,
        });
        webServer!.start();

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Web server started at http://${webServer!.host}:${webServer!.port}`,
                url: `http://${webServer!.host}:${webServer!.port}`,
                port: webServer!.port,
                host: webServer!.host,
              }),
            },
          ],
        };
      }

      case "stop-web-server": {
        if (!webServer) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  message: "Web server is not running",
                }),
              },
            ],
          };
        }

        webServer.stop();
        webServer = null;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: "Web server stopped",
              }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("term-mcp server running on stdio");
}

main().catch(console.error);
