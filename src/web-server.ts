#!/usr/bin/env node
/**
 * Web server for termwright with ghostty-web integration.
 * Provides browser-based terminal access with WebSocket communication.
 * Supports both Node.js and Bun runtimes.
 */

import { GhosttyManager } from "./ghostty-manager";
import type { WebServerConfig, GhosttySpawnOptions } from "./types";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createServer, type IncomingMessage, type ServerResponse, type Server as HttpServer } from "http";
import { WebSocketServer, WebSocket as WsWebSocket } from "ws";

// Get the path to ghostty-web assets
function getGhosttyWebPath(): string {
  const possiblePaths = [
    join(process.cwd(), "node_modules", "ghostty-web"),
    join(dirname(fileURLToPath(import.meta.url)), "..", "node_modules", "ghostty-web"),
  ];

  for (const p of possiblePaths) {
    try {
      const { statSync } = require("fs");
      statSync(join(p, "dist", "ghostty-web.js"));
      return p;
    } catch {
      continue;
    }
  }

  return join(process.cwd(), "node_modules", "ghostty-web");
}

// HTML template for terminal page using ghostty-web
function getTerminalHtml(sessionId: string, wsUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>termwright: ${sessionId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1b26;
      color: #a9b1d6;
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #header {
      background: #16161e;
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #33467c;
      flex-shrink: 0;
    }
    #header h1 { font-size: 14px; font-weight: 500; color: #7aa2f7; }
    #header .status { font-size: 12px; display: flex; align-items: center; gap: 8px; }
    #header .status .dot { width: 8px; height: 8px; border-radius: 50%; background: #9ece6a; }
    #header .status .dot.disconnected { background: #f7768e; }
    #terminal-container { flex: 1; overflow: hidden; position: relative; }
    #terminal { width: 100%; height: 100%; }
    #loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: #7aa2f7; font-size: 16px; }
  </style>
</head>
<body>
  <div id="header">
    <h1>termwright: ${sessionId}</h1>
    <div class="status">
      <span id="status-text">Loading...</span>
      <div id="status-dot" class="dot disconnected"></div>
    </div>
  </div>
  <div id="terminal-container">
    <div id="loading">Initializing terminal...</div>
    <div id="terminal"></div>
  </div>

  <script type="module">
    import { init, Terminal, FitAddon } from '/ghostty-web/ghostty-web.js';

    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');
    const loadingEl = document.getElementById('loading');
    const terminalContainer = document.getElementById('terminal');

    let ws = null;
    let term = null;
    let fitAddon = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    async function initTerminal() {
      try {
        await init('/ghostty-web/ghostty-vt.wasm');

        term = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          theme: {
            background: '#1a1b26',
            foreground: '#a9b1d6',
            cursor: '#c0caf5',
            selectionBackground: '#33467c',
            black: '#15161e',
            red: '#f7768e',
            green: '#9ece6a',
            yellow: '#e0af68',
            blue: '#7aa2f7',
            magenta: '#bb9af7',
            cyan: '#7dcfff',
            white: '#c0caf5',
            brightBlack: '#414868',
            brightRed: '#f7768e',
            brightGreen: '#9ece6a',
            brightYellow: '#e0af68',
            brightBlue: '#7aa2f7',
            brightMagenta: '#bb9af7',
            brightCyan: '#7dcfff',
            brightWhite: '#c0caf5',
          },
        });

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalContainer);
        fitAddon.fit();

        loadingEl.style.display = 'none';

        term.onData((data) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'input', data }));
          }
        });

        term.onResize(({ cols, rows }) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        });

        connect();

        window.addEventListener('resize', () => {
          if (fitAddon) fitAddon.fit();
        });

      } catch (error) {
        console.error('Failed to initialize terminal:', error);
        loadingEl.textContent = 'Failed to initialize terminal: ' + error.message;
        loadingEl.style.color = '#f7768e';
      }
    }

    function connect() {
      ws = new WebSocket('${wsUrl}');

      ws.onopen = () => {
        statusText.textContent = 'Connected';
        statusDot.classList.remove('disconnected');
        reconnectAttempts = 0;

        if (term && fitAddon) {
          const dims = fitAddon.proposeDimensions();
          if (dims) {
            ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }));
          }
        }
      };

      ws.onmessage = (event) => {
        if (term) term.write(event.data);
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

      ws.onerror = (error) => console.error('WebSocket error:', error);
    }

    initTerminal();
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
  <title>termwright Web Server</title>
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
    h1 { font-size: 2rem; margin-bottom: 8px; color: #7aa2f7; }
    .subtitle { color: #565f89; margin-bottom: 32px; }
    .card {
      background: #16161e;
      border: 1px solid #33467c;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .card h2 { font-size: 1.25rem; margin-bottom: 16px; color: #bb9af7; }
    .sessions-list { list-style: none; }
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
    .sessions-list .backend { font-size: 12px; padding: 2px 8px; background: #33467c; border-radius: 4px; }
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
    .empty { color: #565f89; font-style: italic; }
    a { color: #7aa2f7; text-decoration: none; }
    a:hover { text-decoration: underline; }
    code { background: #1a1b26; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; }
  </style>
</head>
<body>
  <div class="container">
    <h1>termwright</h1>
    <p class="subtitle">Puppeteer for terminals - Web Interface with ghostty-web</p>

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

// Main web server - Node.js implementation using http + ws
export class TermwrightWebServer {
  private httpServer: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private config: Required<WebServerConfig>;

  constructor(config: WebServerConfig = {}) {
    this.config = {
      port: config.port ?? 3000,
      host: config.host ?? "localhost",
      cors: config.cors ?? true,
    };

    GhosttyManager.configureWebServer(this.config.host, this.config.port);
  }

  private getCorsHeaders(): Record<string, string> {
    return this.config.cors
      ? {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      : {};
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method || "GET";
    const corsHeaders = this.getCorsHeaders();

    // Set CORS headers
    for (const [key, value] of Object.entries(corsHeaders)) {
      res.setHeader(key, value);
    }

    // Handle OPTIONS for CORS
    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // API routes
    if (path === "/api/sessions" && method === "GET") {
      const sessions = GhosttyManager.list();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ sessions }));
      return;
    }

    if (path === "/api/sessions" && method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body) as GhosttySpawnOptions;
          const options: GhosttySpawnOptions = {
            backend: parsed.backend || "web",
            shell: parsed.shell,
            cwd: parsed.cwd,
            env: parsed.env,
            cols: parsed.cols,
            rows: parsed.rows,
            title: parsed.title,
            fontSize: parsed.fontSize,
            theme: parsed.theme,
          };

          const session = GhosttyManager.spawn(options);
          await new Promise((resolve) => setTimeout(resolve, 200));

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              sessionId: session.id,
              pid: session.pid,
              cwd: session.cwd,
              backend: session.backend,
              webUrl: session.webUrl,
              windowId: session.windowId,
            })
          );
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid request body" }));
        }
      });
      return;
    }

    if (path.startsWith("/api/sessions/") && method === "DELETE") {
      const sessionId = path.slice(14);
      const destroyed = GhosttyManager.destroy(sessionId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: destroyed }));
      return;
    }

    if (path === "/api/backends" && method === "GET") {
      const backends = GhosttyManager.getAvailableBackends();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ backends }));
      return;
    }

    // Serve ghostty-web static assets
    if (path.startsWith("/ghostty-web/")) {
      const filename = path.slice(13);
      const ghosttyPath = getGhosttyWebPath();

      try {
        let filePath: string;
        let contentType: string;

        if (filename === "ghostty-web.js") {
          filePath = join(ghosttyPath, "dist", "ghostty-web.js");
          contentType = "application/javascript";
        } else if (filename === "ghostty-vt.wasm") {
          filePath = join(ghosttyPath, "ghostty-vt.wasm");
          contentType = "application/wasm";
        } else {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const content = readFileSync(filePath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
      } catch (error) {
        console.error(`Failed to serve ${filename}:`, error);
        res.writeHead(500);
        res.end("Failed to load ghostty-web assets");
      }
      return;
    }

    // Terminal page
    if (path.startsWith("/terminal/")) {
      const sessionId = path.slice(10);
      const session = GhosttyManager.get(sessionId);

      if (!session) {
        res.writeHead(404);
        res.end("Session not found");
        return;
      }

      const { host, port } = this.config;
      const wsProtocol = host === "localhost" ? "ws" : "wss";
      const wsUrl = `${wsProtocol}://${host}:${port}/ws/${sessionId}`;
      const html = getTerminalHtml(sessionId, wsUrl);

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
      return;
    }

    // Index page
    if (path === "/" || path === "/index.html") {
      const html = getIndexHtml(this.config.host, this.config.port);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  }

  start(): void {
    const { port, host } = this.config;

    // Create HTTP server
    this.httpServer = createServer((req, res) => {
      this.handleRequest(req, res).catch((error) => {
        console.error("Request error:", error);
        res.writeHead(500);
        res.end("Internal server error");
      });
    });

    // Create WebSocket server
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.wss.on("connection", (ws: WsWebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || "/", `http://${req.headers.host}`);
      const path = url.pathname;

      if (!path.startsWith("/ws/")) {
        ws.close(1008, "Invalid path");
        return;
      }

      const sessionId = path.slice(4);
      const session = GhosttyManager.get(sessionId);

      if (!session) {
        ws.close(1008, "Session not found");
        return;
      }

      // Add WebSocket connection to session
      session.addWsConnection(ws as unknown as WebSocket);

      ws.on("message", (message: Buffer | string) => {
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
      });

      ws.on("close", () => {
        session.removeWsConnection(ws as unknown as WebSocket);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
        session.removeWsConnection(ws as unknown as WebSocket);
      });
    });

    this.httpServer.listen(port, host, () => {
      console.log(`termwright web server running at http://${host}:${port}`);
    });
  }

  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
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
const isMain = process.argv[1]?.includes("web-server") || import.meta.url.endsWith(process.argv[1] || "");

if (isMain) {
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
termwright-web: Web server for terminal access with ghostty-web

Usage: termwright-web [options]

Options:
  -p, --port <port>  Port to listen on (default: 3000)
  -h, --host <host>  Host to bind to (default: localhost)
  --help             Show this help message

Examples:
  termwright-web
  termwright-web --port 8080
  termwright-web --host 0.0.0.0 --port 3000
`);
      process.exit(0);
    }
  }

  const server = new TermwrightWebServer({ port, host });
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
