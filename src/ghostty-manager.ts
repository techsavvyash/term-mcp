import { nanoid } from "nanoid";
import { GhosttySession } from "./ghostty-session";
import type { GhosttySpawnOptions, GhosttySessionInfo } from "./types";

/**
 * GhosttyManager is a singleton that manages all Ghostty terminal sessions.
 * It provides methods to create, retrieve, list, and destroy sessions with
 * support for multiple backends (PTY, native Ghostty, web).
 */
class GhosttyManagerClass {
  private sessions: Map<string, GhosttySession> = new Map();
  private cleanupRegistered = false;
  private webServerPort?: number;
  private webServerHost?: string;

  constructor() {
    this.registerCleanup();
  }

  /**
   * Configure web server details for web backend sessions.
   */
  configureWebServer(host: string, port: number): void {
    this.webServerHost = host;
    this.webServerPort = port;
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
   * Spawn a new Ghostty terminal session.
   */
  spawn(options: GhosttySpawnOptions = {}): GhosttySession {
    const id = `ghostty-${nanoid(8)}`;
    const session = new GhosttySession(id, options);
    this.sessions.set(id, session);

    // Set web URL if using web backend
    if (options.backend === "web" && this.webServerPort) {
      const host = this.webServerHost || "localhost";
      session.setWebUrl(`http://${host}:${this.webServerPort}/terminal/${id}`);
    }

    return session;
  }

  /**
   * Get a session by ID.
   */
  get(sessionId: string): GhosttySession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get a session by ID, throwing if not found.
   */
  getOrThrow(sessionId: string): GhosttySession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    return session;
  }

  /**
   * List all sessions.
   */
  list(): GhosttySessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.getInfo());
  }

  /**
   * List sessions by backend type.
   */
  listByBackend(backend: "pty" | "native" | "web"): GhosttySessionInfo[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.backend === backend)
      .map((s) => s.getInfo());
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

  /**
   * Check if Ghostty native app is available.
   */
  isGhosttyAvailable(): boolean {
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
        return true;
      } catch {
        continue;
      }
    }

    try {
      const { execSync } = require("child_process");
      execSync("which ghostty", { encoding: "utf8" });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get available backends.
   */
  getAvailableBackends(): Array<"pty" | "native" | "web"> {
    const backends: Array<"pty" | "native" | "web"> = ["pty", "web"];
    if (this.isGhosttyAvailable()) {
      backends.push("native");
    }
    return backends;
  }
}

// Export singleton instance
export const GhosttyManager = new GhosttyManagerClass();

// Also export the class for testing purposes
export { GhosttyManagerClass };
