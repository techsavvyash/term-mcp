import * as pty from "node-pty";
import { spawn, type ChildProcess } from "child_process";
import { OutputBuffer } from "./output-buffer";
import type {
  GhosttySpawnOptions,
  GhosttySessionInfo,
  GhosttyBackend,
  GhosttyTheme,
  WaitOptions,
  ReadOptions,
  RunCommandResult,
} from "./types";

const DEFAULT_THEME: GhosttyTheme = {
  background: "#1a1b26",
  foreground: "#a9b1d6",
  cursor: "#c0caf5",
  selection: "#33467c",
  black: "#15161e",
  red: "#f7768e",
  green: "#9ece6a",
  yellow: "#e0af68",
  blue: "#7aa2f7",
  magenta: "#bb9af7",
  cyan: "#7dcfff",
  white: "#c0caf5",
};

/**
 * GhosttySession provides terminal emulation with multiple backend support:
 * - pty: Headless PTY (node-pty) for programmatic control
 * - native: Spawns native Ghostty terminal window
 * - web: Provides WebSocket access for browser-based terminals
 */
export class GhosttySession {
  readonly id: string;
  readonly createdAt: Date;
  readonly cwd: string;
  readonly backend: GhosttyBackend;
  readonly theme: GhosttyTheme;
  readonly fontSize: number;
  readonly title: string;

  private ptyProcess: pty.IPty | null = null;
  private nativeProcess: ChildProcess | null = null;
  private outputBuffer: OutputBuffer;
  private _alive: boolean = true;
  private _pid: number = 0;
  private _webUrl?: string;
  private _windowId?: string;

  // WebSocket connections for web backend
  private wsConnections: Set<WebSocket> = new Set();

  constructor(id: string, options: GhosttySpawnOptions = {}) {
    this.id = id;
    this.createdAt = new Date();
    this.cwd = options.cwd || process.cwd();
    this.backend = options.backend || "pty";
    this.theme = { ...DEFAULT_THEME, ...options.theme };
    this.fontSize = options.fontSize || 14;
    this.title = options.title || `term-mcp: ${id}`;
    this.outputBuffer = new OutputBuffer();

    this.spawn(options);
  }

  private spawn(options: GhosttySpawnOptions): void {
    switch (this.backend) {
      case "pty":
        this.spawnPty(options);
        break;
      case "native":
        this.spawnNative(options);
        break;
      case "web":
        // Web backend uses PTY but exposes via WebSocket
        this.spawnPty(options);
        break;
    }
  }

  private spawnPty(options: GhosttySpawnOptions): void {
    const shell =
      options.shell ||
      process.env.SHELL ||
      (process.platform === "win32" ? "powershell.exe" : "/bin/bash");

    this.ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: this.cwd,
      env: {
        ...process.env,
        ...options.env,
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
      } as Record<string, string>,
    });

    this._pid = this.ptyProcess.pid;

    this.ptyProcess.onData((data) => {
      this.outputBuffer.append(data);
      // Broadcast to WebSocket connections for web backend
      if (this.backend === "web") {
        this.broadcast(data);
      }
    });

    this.ptyProcess.onExit(() => {
      this._alive = false;
      this.closeAllWsConnections();
    });
  }

  private spawnNative(options: GhosttySpawnOptions): void {
    // Check if Ghostty is available
    const ghosttyPath = this.findGhosttyPath();

    if (!ghosttyPath) {
      // Fall back to PTY if Ghostty is not installed
      console.error("Ghostty not found, falling back to PTY backend");
      (this as { backend: GhosttyBackend }).backend = "pty";
      this.spawnPty(options);
      return;
    }

    const shell =
      options.shell ||
      process.env.SHELL ||
      (process.platform === "win32" ? "powershell.exe" : "/bin/bash");

    // Build Ghostty command arguments
    const args: string[] = [
      "-e", shell,
      `--title=${this.title}`,
      `--working-directory=${this.cwd}`,
    ];

    // Add theme configuration
    if (this.theme.background) {
      args.push(`--background=${this.theme.background}`);
    }
    if (this.theme.foreground) {
      args.push(`--foreground=${this.theme.foreground}`);
    }

    // Also spawn a PTY for programmatic control
    this.spawnPty(options);

    // Spawn the Ghostty window
    this.nativeProcess = spawn(ghosttyPath, args, {
      detached: true,
      stdio: "ignore",
      cwd: this.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
    });

    this._windowId = `ghostty-${this.nativeProcess.pid}`;

    this.nativeProcess.on("exit", () => {
      // Native window closed but PTY might still be alive
    });

    this.nativeProcess.unref();
  }

  private findGhosttyPath(): string | null {
    const paths = [
      "/usr/local/bin/ghostty",
      "/usr/bin/ghostty",
      "/opt/homebrew/bin/ghostty",
      "/Applications/Ghostty.app/Contents/MacOS/ghostty",
      `${process.env.HOME}/.local/bin/ghostty`,
    ];

    for (const p of paths) {
      try {
        const { statSync } = require("fs");
        statSync(p);
        return p;
      } catch {
        continue;
      }
    }

    // Try to find via PATH
    try {
      const { execSync } = require("child_process");
      const result = execSync("which ghostty", { encoding: "utf8" }).trim();
      if (result) return result;
    } catch {
      // Not found in PATH
    }

    return null;
  }

  /**
   * Get the process ID.
   */
  get pid(): number {
    return this._pid;
  }

  /**
   * Check if the session is still alive.
   */
  get alive(): boolean {
    return this._alive;
  }

  /**
   * Get web URL for web backend.
   */
  get webUrl(): string | undefined {
    return this._webUrl;
  }

  /**
   * Set web URL (called by WebServer).
   */
  setWebUrl(url: string): void {
    this._webUrl = url;
  }

  /**
   * Get window ID for native backend.
   */
  get windowId(): string | undefined {
    return this._windowId;
  }

  /**
   * Get session information.
   */
  getInfo(): GhosttySessionInfo {
    return {
      id: this.id,
      pid: this._pid,
      createdAt: this.createdAt,
      cwd: this.cwd,
      alive: this._alive,
      backend: this.backend,
      webUrl: this._webUrl,
      windowId: this._windowId,
    };
  }

  /**
   * Write data to the terminal.
   */
  write(data: string): void {
    if (!this._alive) {
      throw new Error(`Session ${this.id} is not alive`);
    }
    if (this.ptyProcess) {
      this.ptyProcess.write(data);
    }
  }

  /**
   * Read from the output buffer.
   */
  read(options: ReadOptions = {}): string {
    return this.outputBuffer.read(options);
  }

  /**
   * Clear the output buffer.
   */
  clearBuffer(): void {
    this.outputBuffer.clear();
  }

  /**
   * Wait for a pattern to appear in the output.
   */
  waitFor(pattern: string | RegExp, options: WaitOptions = {}): Promise<string> {
    return this.outputBuffer.waitFor(pattern, options);
  }

  /**
   * Run a command and wait for it to complete.
   */
  async runCommand(
    command: string,
    options: {
      timeout?: number;
      waitFor?: string | RegExp;
    } = {}
  ): Promise<RunCommandResult> {
    const { timeout = 30000 } = options;

    this.outputBuffer.clear();
    this.write(command + "\n");

    const waitPattern = options.waitFor || /[\$#>]\s*$/m;

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const output = await this.outputBuffer.waitFor(waitPattern, {
        timeout,
        clear: false,
      });
      return { output, completed: true };
    } catch {
      return {
        output: this.outputBuffer.read(),
        completed: false,
      };
    }
  }

  /**
   * Resize the terminal.
   */
  resize(cols: number, rows: number): void {
    if (this.ptyProcess) {
      this.ptyProcess.resize(cols, rows);
    }
    // Broadcast resize to web clients
    if (this.backend === "web") {
      this.broadcastJson({ type: "resize", cols, rows });
    }
  }

  /**
   * Add a WebSocket connection (for web backend).
   */
  addWsConnection(ws: WebSocket): void {
    this.wsConnections.add(ws);
    // Send current buffer to new connection
    const currentBuffer = this.outputBuffer.read();
    if (currentBuffer) {
      try {
        ws.send(currentBuffer);
      } catch {
        // Ignore send errors
      }
    }
  }

  /**
   * Remove a WebSocket connection.
   */
  removeWsConnection(ws: WebSocket): void {
    this.wsConnections.delete(ws);
  }

  /**
   * Broadcast data to all WebSocket connections.
   */
  private broadcast(data: string): void {
    for (const ws of this.wsConnections) {
      try {
        ws.send(data);
      } catch {
        this.wsConnections.delete(ws);
      }
    }
  }

  /**
   * Broadcast JSON message to all WebSocket connections.
   */
  private broadcastJson(message: object): void {
    const data = JSON.stringify(message);
    for (const ws of this.wsConnections) {
      try {
        ws.send(data);
      } catch {
        this.wsConnections.delete(ws);
      }
    }
  }

  /**
   * Close all WebSocket connections.
   */
  private closeAllWsConnections(): void {
    for (const ws of this.wsConnections) {
      try {
        ws.close();
      } catch {
        // Ignore close errors
      }
    }
    this.wsConnections.clear();
  }

  /**
   * Kill the terminal session.
   */
  kill(): void {
    if (this._alive) {
      this.outputBuffer.cancelAllWaiters();
      this.closeAllWsConnections();

      if (this.ptyProcess) {
        this.ptyProcess.kill();
      }

      if (this.nativeProcess) {
        try {
          this.nativeProcess.kill();
        } catch {
          // Process might already be dead
        }
      }

      this._alive = false;
    }
  }

  /**
   * Destroy the session and clean up resources.
   */
  destroy(): void {
    this.kill();
  }

  /**
   * Get theme configuration as CSS variables.
   */
  getThemeCss(): string {
    return `
      :root {
        --term-background: ${this.theme.background || DEFAULT_THEME.background};
        --term-foreground: ${this.theme.foreground || DEFAULT_THEME.foreground};
        --term-cursor: ${this.theme.cursor || DEFAULT_THEME.cursor};
        --term-selection: ${this.theme.selection || DEFAULT_THEME.selection};
        --term-font-size: ${this.fontSize}px;
      }
    `;
  }
}
