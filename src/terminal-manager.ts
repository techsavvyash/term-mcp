import { nanoid } from "nanoid";
import { TerminalSession } from "./session";
import { TmuxSession } from "./tmux-session";
import type { SpawnOptions, SessionInfo, WaitOptions, ReadOptions, RunCommandResult } from "./types";

/**
 * Common interface for both PTY and Tmux sessions.
 */
export interface ITerminalSession {
  readonly id: string;
  readonly createdAt: Date;
  readonly cwd: string;
  readonly alive: boolean;
  getInfo(): SessionInfo;
  write(data: string): void;
  read(options?: ReadOptions): string;
  clearBuffer(): void;
  waitFor(pattern: string | RegExp, options?: WaitOptions): Promise<string>;
  runCommand(command: string, options?: { timeout?: number; waitFor?: string | RegExp }): Promise<RunCommandResult>;
  resize(cols: number, rows: number): void;
  kill(): void;
  destroy(): void;
}

/**
 * TerminalManager is a singleton that manages all terminal sessions.
 * It provides methods to create, retrieve, list, and destroy sessions.
 */
class TerminalManagerClass {
  private sessions: Map<string, ITerminalSession> = new Map();
  private cleanupRegistered = false;

  constructor() {
    this.registerCleanup();
  }

  /**
   * Register process cleanup handlers to destroy all sessions on exit.
   */
  private registerCleanup(): void {
    if (this.cleanupRegistered) return;
    this.cleanupRegistered = true;

    const cleanup = () => {
      this.destroyAll();
    };

    process.on("exit", cleanup);
    process.on("SIGINT", () => {
      cleanup();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      cleanup();
      process.exit(0);
    });
    process.on("uncaughtException", (error) => {
      console.error("Uncaught exception:", error);
      cleanup();
      process.exit(1);
    });
  }

  /**
   * Spawn a new terminal session.
   * @param options - Spawn options. If `visible: true`, creates a tmux session
   *                  that can be attached to with `tmux attach -t <name>`.
   */
  spawn(options: SpawnOptions = {}): ITerminalSession {
    const id = nanoid(8);

    let session: ITerminalSession;

    if (options.visible) {
      // Create a visible tmux session
      session = new TmuxSession(id, options);
    } else {
      // Create a headless PTY session
      session = new TerminalSession(`term-${id}`, options);
    }

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get a session by ID.
   */
  get(sessionId: string): ITerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get a session by ID, throwing if not found.
   */
  getOrThrow(sessionId: string): ITerminalSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * List all sessions.
   */
  list(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.getInfo());
  }

  /**
   * Destroy a session by ID.
   */
  destroy(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.destroy();
      this.sessions.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Destroy all sessions.
   */
  destroyAll(): void {
    for (const session of this.sessions.values()) {
      session.destroy();
    }
    this.sessions.clear();
  }

  /**
   * Get the number of active sessions.
   */
  get count(): number {
    return this.sessions.size;
  }
}

// Export singleton instance
export const TerminalManager = new TerminalManagerClass();

// Also export the class for testing purposes
export { TerminalManagerClass };
