// Core exports (PTY-based terminal sessions)
export { TerminalManager } from "./managers/terminal-manager.js";
export { TerminalSession } from "./sessions/session.js";
export { TmuxSession } from "./sessions/tmux-session.js";
export { OutputBuffer } from "./utils/output-buffer.js";

// Ghostty exports (libghostty-based terminal sessions)
export { GhosttyManager } from "./managers/ghostty-manager.js";
export { GhosttySession } from "./sessions/ghostty-session.js";

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
} from "./types/index.js";
