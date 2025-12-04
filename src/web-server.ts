#!/usr/bin/env bun
/**
 * Web server for term-mcp with ghostty-web integration.
 * Provides browser-based terminal access with WebSocket communication.
 */

import { GhosttyManager } from "./ghostty-manager";
import type { WebServerConfig, GhosttySpawnOptions } from "./types";

// HTML template for terminal page
function getTerminalHtml(sessionId: string, wsUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>term-mcp: ${sessionId}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      background: #1a1b26;
      color: #a9b1d6;
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    #header {
      background: #16161e;
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #33467c;
    }
    #header h1 {
      font-size: 14px;
      font-weight: 500;
      color: #7aa2f7;
    }
    #header .status {
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    #header .status .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #9ece6a;
    }
    #header .status .dot.disconnected {
      background: #f7768e;
    }
    #terminal-container {
      flex: 1;
      padding: 8px;
      overflow: hidden;
    }
    #terminal {
      width: 100%;
      height: 100%;
      background: #1a1b26;
      color: #a9b1d6;
      font-size: 14px;
      line-height: 1.4;
      padding: 8px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    #input-container {
      background: #16161e;
      padding: 8px 16px;
      border-top: 1px solid #33467c;
    }
    #input {
      width: 100%;
      background: #1a1b26;
      border: 1px solid #33467c;
      color: #a9b1d6;
      padding: 8px 12px;
      font-family: inherit;
      font-size: 14px;
      border-radius: 4px;
      outline: none;
    }
    #input:focus {
      border-color: #7aa2f7;
    }
    .ansi-bright-black { color: #414868; }
    .ansi-red { color: #f7768e; }
    .ansi-green { color: #9ece6a; }
    .ansi-yellow { color: #e0af68; }
    .ansi-blue { color: #7aa2f7; }
    .ansi-magenta { color: #bb9af7; }
    .ansi-cyan { color: #7dcfff; }
    .ansi-white { color: #c0caf5; }
  </style>
</head>
<body>
  <div id="header">
    <h1>🖥️ term-mcp: ${sessionId}</h1>
    <div class="status">
      <span id="status-text">Connecting...</span>
      <div id="status-dot" class="dot disconnected"></div>
    </div>
  </div>
  <div id="terminal-container">
    <div id="terminal"></div>
  </div>
  <div id="input-container">
    <input type="text" id="input" placeholder="Type command and press Enter..." autofocus />
  </div>

  <script>
    const terminal = document.getElementById('terminal');
    const input = document.getElementById('input');
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');

    let ws = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    function connect() {
      ws = new WebSocket('${wsUrl}');

      ws.onopen = () => {
        statusText.textContent = 'Connected';
        statusDot.classList.remove('disconnected');
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        // Parse and render terminal output
        appendOutput(event.data);
      };

      ws.onclose = () => {
        statusText.textContent = 'Disconnected';
        statusDot.classList.add('disconnected');

        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          statusText.textContent = 'Reconnecting... (' + reconnectAttempts + '/' + maxReconnectAttempts + ')';
          setTimeout(connect, 1000 * reconnectAttempts);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    }

    function appendOutput(data) {
      // Simple ANSI code stripping for display (ghostty-web would handle this properly)
      const cleaned = data
        .replace(/\\x1b\\[[0-9;]*[a-zA-Z]/g, '')
        .replace(/\\x1b\\][^\\x07]*\\x07/g, '');

      terminal.textContent += data;
      terminal.scrollTop = terminal.scrollHeight;
    }

    function sendInput(data) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        sendInput(input.value + '\\n');
        input.value = '';
      } else if (e.key === 'Tab') {
        e.preventDefault();
        sendInput('\\t');
      } else if (e.ctrlKey && e.key === 'c') {
        sendInput('\\x03');
      } else if (e.ctrlKey && e.key === 'd') {
        sendInput('\\x04');
      }
    });

    // Start connection
    connect();
  </script>
</body>
</html>`;
}

// Index page HTML
function getIndexHtml(host: string, port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>term-mcp Web Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1b26;
      color: #a9b1d6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      padding: 40px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    h1 {
      font-size: 2rem;
      margin-bottom: 8px;
      color: #7aa2f7;
    }
    .subtitle {
      color: #565f89;
      margin-bottom: 32px;
    }
    .card {
      background: #16161e;
      border: 1px solid #33467c;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .card h2 {
      font-size: 1.25rem;
      margin-bottom: 16px;
      color: #bb9af7;
    }
    .sessions-list {
      list-style: none;
    }
    .sessions-list li {
      padding: 12px 16px;
      background: #1a1b26;
      border-radius: 4px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sessions-list .id { color: #9ece6a; font-family: monospace; }
    .sessions-list .backend {
      font-size: 12px;
      padding: 2px 8px;
      background: #33467c;
      border-radius: 4px;
    }
    button {
      background: #7aa2f7;
      color: #1a1b26;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }
    button:hover { background: #89b4fa; }
    .empty {
      color: #565f89;
      font-style: italic;
    }
    a { color: #7aa2f7; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      background: #1a1b26;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🖥️ term-mcp</h1>
    <p class="subtitle">Puppeteer for terminals - Web Interface</p>

    <div class="card">
      <h2>Active Sessions</h2>
      <ul id="sessions" class="sessions-list">
        <li class="empty">Loading sessions...</li>
      </ul>
    </div>

    <div class="card">
      <h2>Create New Terminal</h2>
      <button id="create-btn">Create Web Terminal</button>
    </div>

    <div class="card">
      <h2>API Endpoints</h2>
      <ul style="list-style: disc; margin-left: 20px; line-height: 2;">
        <li><code>GET /api/sessions</code> - List all sessions</li>
        <li><code>POST /api/sessions</code> - Create new session</li>
        <li><code>DELETE /api/sessions/:id</code> - Close session</li>
        <li><code>GET /terminal/:id</code> - Open terminal in browser</li>
        <li><code>WS /ws/:id</code> - WebSocket for terminal I/O</li>
      </ul>
    </div>
  </div>

  <script>
    async function loadSessions() {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      const list = document.getElementById('sessions');

      if (data.sessions.length === 0) {
        list.innerHTML = '<li class="empty">No active sessions</li>';
        return;
      }

      list.innerHTML = data.sessions.map(s =>
        '<li>' +
          '<span class="id"><a href="/terminal/' + s.id + '">' + s.id + '</a></span>' +
          '<span class="backend">' + s.backend + '</span>' +
        '</li>'
      ).join('');
    }

    document.getElementById('create-btn').addEventListener('click', async () => {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backend: 'web' })
      });
      const data = await res.json();
      window.location.href = '/terminal/' + data.sessionId;
    });

    loadSessions();
    setInterval(loadSessions, 5000);
  </script>
</body>
</html>`;
}

/// <reference path="./bun.d.ts" />

// Main web server
export class TermMcpWebServer {
  private server: BunServer | null = null;
  private config: Required<WebServerConfig>;

  constructor(config: WebServerConfig = {}) {
    this.config = {
      port: config.port ?? 3000,
      host: config.host ?? "localhost",
      cors: config.cors ?? true,
    };

    // Configure GhosttyManager with web server details
    GhosttyManager.configureWebServer(this.config.host, this.config.port);
  }

  start(): void {
    const { port, host, cors } = this.config;

    // CORS headers helper
    const getCorsHeaders = (): Record<string, string> =>
      cors
        ? {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          }
        : {};

    this.server = Bun.serve({
      port,
      hostname: host,

      fetch: async (req: Request, server: BunServer): Promise<Response | undefined> => {
        const url = new URL(req.url);
        const path = url.pathname;
        const corsHeaders = getCorsHeaders();

        // Handle OPTIONS for CORS
        if (req.method === "OPTIONS") {
          return new Response(null, { headers: corsHeaders });
        }

        // WebSocket upgrade for terminal connections
        if (path.startsWith("/ws/")) {
          const sessionId = path.slice(4);
          const session = GhosttyManager.get(sessionId);

          if (!session) {
            return new Response("Session not found", { status: 404 });
          }

          const upgraded = server.upgrade(req, { data: { sessionId } });
          if (upgraded) {
            return undefined;
          }
          return new Response("WebSocket upgrade failed", { status: 500 });
        }

        // API routes
        if (path === "/api/sessions" && req.method === "GET") {
          const sessions = GhosttyManager.list();
          return Response.json({ sessions }, { headers: corsHeaders });
        }

        if (path === "/api/sessions" && req.method === "POST") {
          const body = (await req.json()) as GhosttySpawnOptions;
          const options: GhosttySpawnOptions = {
            backend: body.backend || "web",
            shell: body.shell,
            cwd: body.cwd,
            env: body.env,
            cols: body.cols,
            rows: body.rows,
            title: body.title,
            fontSize: body.fontSize,
            theme: body.theme,
          };

          const session = GhosttyManager.spawn(options);

          // Wait for shell to initialize
          await new Promise((resolve) => setTimeout(resolve, 200));

          return Response.json(
            {
              sessionId: session.id,
              pid: session.pid,
              cwd: session.cwd,
              backend: session.backend,
              webUrl: session.webUrl,
              windowId: session.windowId,
            },
            { headers: corsHeaders }
          );
        }

        if (path.startsWith("/api/sessions/") && req.method === "DELETE") {
          const sessionId = path.slice(14);
          const destroyed = GhosttyManager.destroy(sessionId);
          return Response.json({ success: destroyed }, { headers: corsHeaders });
        }

        if (path === "/api/backends" && req.method === "GET") {
          const backends = GhosttyManager.getAvailableBackends();
          return Response.json({ backends }, { headers: corsHeaders });
        }

        // Terminal page
        if (path.startsWith("/terminal/")) {
          const sessionId = path.slice(10);
          const session = GhosttyManager.get(sessionId);

          if (!session) {
            return new Response("Session not found", { status: 404 });
          }

          const wsProtocol = host === "localhost" ? "ws" : "wss";
          const wsUrl = `${wsProtocol}://${host}:${port}/ws/${sessionId}`;
          const html = getTerminalHtml(sessionId, wsUrl);

          return new Response(html, {
            headers: { "Content-Type": "text/html", ...corsHeaders },
          });
        }

        // Index page
        if (path === "/" || path === "/index.html") {
          const html = getIndexHtml(host, port);
          return new Response(html, {
            headers: { "Content-Type": "text/html", ...corsHeaders },
          });
        }

        return new Response("Not found", { status: 404 });
      },

      websocket: {
        open(ws: ServerWebSocket) {
          const { sessionId } = ws.data as { sessionId: string };
          const session = GhosttyManager.get(sessionId);
          if (session) {
            session.addWsConnection(ws as unknown as WebSocket);
          }
        },

        message(ws: ServerWebSocket, message: string | Buffer) {
          const { sessionId } = ws.data as { sessionId: string };
          const session = GhosttyManager.get(sessionId);
          if (!session) return;

          try {
            const data = JSON.parse(message.toString());
            if (data.type === "input") {
              session.write(data.data);
            } else if (data.type === "resize") {
              session.resize(data.cols, data.rows);
            }
          } catch {
            // If not JSON, treat as raw input
            session.write(message.toString());
          }
        },

        close(ws: ServerWebSocket) {
          const { sessionId } = ws.data as { sessionId: string };
          const session = GhosttyManager.get(sessionId);
          if (session) {
            session.removeWsConnection(ws as unknown as WebSocket);
          }
        },
      },
    });

    console.log(`term-mcp web server running at http://${host}:${port}`);
  }

  stop(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
    GhosttyManager.destroyAll();
  }

  get port(): number {
    return this.config.port;
  }

  get host(): string {
    return this.config.host;
  }
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2);
  let port = 3000;
  let host = "localhost";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" || args[i] === "-p") {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === "--host" || args[i] === "-h") {
      host = args[i + 1];
      i++;
    } else if (args[i] === "--help") {
      console.log(`
term-mcp-web: Web server for terminal access

Usage: term-mcp-web [options]

Options:
  -p, --port <port>  Port to listen on (default: 3000)
  -h, --host <host>  Host to bind to (default: localhost)
  --help             Show this help message

Examples:
  term-mcp-web
  term-mcp-web --port 8080
  term-mcp-web --host 0.0.0.0 --port 3000
`);
      process.exit(0);
    }
  }

  const server = new TermMcpWebServer({ port, host });
  server.start();

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    server.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    server.stop();
    process.exit(0);
  });
}
