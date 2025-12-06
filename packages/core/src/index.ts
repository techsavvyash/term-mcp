// Core exports (PTY-based terminal sessions)
export { TerminalManager } from "./managers/terminal-manager";
export { TerminalSession } from "./sessions/session";
export { TmuxSession } from "./sessions/tmux-session";
export { OutputBuffer } from "./utils/output-buffer";

// Ghostty exports (libghostty-based terminal sessions)
export { GhosttyManager } from "./managers/ghostty-manager";
export { GhosttySession } from "./sessions/ghostty-session";

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
