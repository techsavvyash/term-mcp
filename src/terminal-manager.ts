import { nanoid } from "nanoid";
import { TerminalSession } from "./session";
import type { SpawnOptions, SessionInfo } from "./types";

/**
 * TerminalManager is a singleton that manages all terminal sessions.
 * It provides methods to create, retrieve, list, and destroy sessions.
 */
class TerminalManagerClass {
  private sessions: Map<string, TerminalSession> = new Map();
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
   */
  spawn(options: SpawnOptions = {}): TerminalSession {
    const id = `term-${nanoid(8)}`;
    const session = new TerminalSession(id, options);
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Get a session by ID.
   */
  get(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get a session by ID, throwing if not found.
   */
  getOrThrow(sessionId: string): TerminalSession {
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
