import * as pty from "node-pty";
import { OutputBuffer } from "./output-buffer";
import type {
  SpawnOptions,
  SessionInfo,
  WaitOptions,
  ReadOptions,
  RunCommandResult,
} from "./types";

/**
 * TerminalSession wraps a pseudo-terminal (PTY) and provides
 * high-level methods for interacting with it.
 */
export class TerminalSession {
  readonly id: string;
  readonly createdAt: Date;
  readonly cwd: string;

  private ptyProcess: pty.IPty;
  private outputBuffer: OutputBuffer;
  private _alive: boolean = true;

  constructor(id: string, options: SpawnOptions = {}) {
    this.id = id;
    this.createdAt = new Date();
    this.cwd = options.cwd || process.cwd();
    this.outputBuffer = new OutputBuffer();

    // Determine shell to use
    const shell =
      options.shell ||
      process.env.SHELL ||
      (process.platform === "win32" ? "powershell.exe" : "/bin/bash");

    // Spawn the PTY process
    this.ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: this.cwd,
      env: {
        ...process.env,
        ...options.env,
        // Ensure we get proper terminal behavior
        TERM: "xterm-256color",
        // Disable color prompts that might interfere with pattern matching
        // (users can override via env option)
      } as Record<string, string>,
    });

    // Capture output
    this.ptyProcess.onData((data) => {
      this.outputBuffer.append(data);
    });

    // Track process exit
    this.ptyProcess.onExit(() => {
      this._alive = false;
    });
  }

  /**
   * Get the process ID of the spawned shell.
   */
  get pid(): number {
    return this.ptyProcess.pid;
  }

  /**
   * Check if the session is still alive.
   */
  get alive(): boolean {
    return this._alive;
  }

  /**
   * Get session information.
   */
  getInfo(): SessionInfo {
    return {
      id: this.id,
      pid: this.pid,
      createdAt: this.createdAt,
      cwd: this.cwd,
      alive: this._alive,
    };
  }

  /**
   * Write data to the terminal (send input).
   */
  write(data: string): void {
    if (!this._alive) {
      throw new Error(`Session ${this.id} is not alive`);
    }
    this.ptyProcess.write(data);
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
   * This sends the command plus a newline, then waits for the shell prompt
   * or a configurable pattern indicating completion.
   */
  async runCommand(
    command: string,
    options: {
      timeout?: number;
      waitFor?: string | RegExp;
    } = {}
  ): Promise<RunCommandResult> {
    const { timeout = 30000 } = options;

    // Clear buffer before running command to get clean output
    this.outputBuffer.clear();

    // Send the command
    this.write(command + "\n");

    // Wait for completion indicator
    // Default: wait for common shell prompts or the command to echo back plus some output
    const waitPattern =
      options.waitFor ||
      // Match common prompt patterns: $, #, >, or the command followed by output
      /[\$#>]\s*$/m;

    try {
      // Wait a bit for initial output, then wait for the pattern
      await new Promise((resolve) => setTimeout(resolve, 100));
      const output = await this.outputBuffer.waitFor(waitPattern, {
        timeout,
        clear: false,
      });
      return { output, completed: true };
    } catch (error) {
      // Timeout - return whatever we have
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
    this.ptyProcess.resize(cols, rows);
  }

  /**
   * Kill the terminal session.
   */
  kill(): void {
    if (this._alive) {
      this.outputBuffer.cancelAllWaiters();
      this.ptyProcess.kill();
      this._alive = false;
    }
  }

  /**
   * Destroy the session and clean up resources.
   */
  destroy(): void {
    this.kill();
  }
}
