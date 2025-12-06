// Core exports (PTY-based terminal sessions)
export { TerminalManager } from "./managers/terminal-manager.js";
export { TerminalSession } from "./sessions/session.js";
export { TmuxSession } from "./sessions/tmux-session.js";
export { OutputBuffer } from "./utils/output-buffer.js";

// Type exports
export type {
  SpawnOptions,
  SessionInfo,
  WaitOptions,
  ReadOptions,
  RunCommandResult,
} from "./types/index.js";
