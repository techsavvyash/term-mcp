import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { TerminalManager } from "./terminal-manager";

// Tool schemas
const SpawnTerminalSchema = z.object({
  shell: z.string().optional().describe("Shell to use (default: user's shell or /bin/bash)"),
  cwd: z.string().optional().describe("Working directory for the terminal"),
  env: z.record(z.string()).optional().describe("Additional environment variables to set"),
  cols: z.number().optional().describe("Terminal columns (default: 80)"),
  rows: z.number().optional().describe("Terminal rows (default: 24)"),
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
    version: "0.1.0",
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
          "Spawn a new terminal session. Returns a session ID that must be used for all subsequent operations on this terminal.",
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
        });

        // Wait a moment for the shell to initialize
        await new Promise((resolve) => setTimeout(resolve, 200));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                sessionId: session.id,
                pid: session.pid,
                cwd: session.cwd,
                message: `Terminal session ${session.id} spawned successfully.`,
              }),
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
