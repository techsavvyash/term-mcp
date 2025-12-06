// Core exports (legacy PTY-based)
export { TerminalManager } from "./terminal-manager";
export { TerminalSession } from "./session";
export { TmuxSession } from "./tmux-session";
export { OutputBuffer } from "./output-buffer";

// Ghostty exports (new libghostty-based)
export { GhosttyManager } from "./ghostty-manager";
export { GhosttySession } from "./ghostty-session";

// Note: TermMcpWebServer requires Bun runtime and is available via:
// - Direct run: bun run src/web-server.ts
// - Compiled: bun dist/web-server.js
// - Import (in Bun only): import { TermMcpWebServer } from "term-mcp/dist/web-server"

// Type exports
export type {
  SpawnOptions,
  SessionInfo,
  WaitOptions,
  ReadOptions,
  RunCommandResult,
  // Ghostty types
  GhosttyBackend,
  GhosttySpawnOptions,
  GhosttyTheme,
  GhosttySessionInfo,
  WebServerConfig,
} from "./types";
