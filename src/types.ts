export interface SpawnOptions {
  /** Shell to use (default: user's shell or /bin/bash) */
  shell?: string;
  /** Working directory */
  cwd?: string;
  /** Environment variables to set */
  env?: Record<string, string>;
  /** Terminal columns (default: 80) */
  cols?: number;
  /** Terminal rows (default: 24) */
  rows?: number;
}

export interface SessionInfo {
  /** Unique session identifier */
  id: string;
  /** Process ID of the spawned shell */
  pid: number;
  /** When the session was created */
  createdAt: Date;
  /** Working directory */
  cwd: string;
  /** Whether the session is still alive */
  alive: boolean;
}

export interface WaitOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Clear buffer after match (default: false) */
  clear?: boolean;
}

export interface ReadOptions {
  /** Clear buffer after read (default: false) */
  clear?: boolean;
  /** Return only the last N lines */
  lines?: number;
}

export interface RunCommandResult {
  /** Command output */
  output: string;
  /** Whether the command appeared to complete */
  completed: boolean;
}

// Ghostty-specific types
export type GhosttyBackend = "pty" | "native" | "web";

export interface GhosttySpawnOptions extends SpawnOptions {
  /** Backend to use for terminal rendering */
  backend?: GhosttyBackend;
  /** Window title (for native backend) */
  title?: string;
  /** Font size (default: 14) */
  fontSize?: number;
  /** Theme configuration */
  theme?: GhosttyTheme;
}

export interface GhosttyTheme {
  background?: string;
  foreground?: string;
  cursor?: string;
  selection?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
}

export interface GhosttySessionInfo extends SessionInfo {
  /** Backend being used */
  backend: GhosttyBackend;
  /** Web URL if using web backend */
  webUrl?: string;
  /** Window ID if using native backend */
  windowId?: string;
}

export interface WebServerConfig {
  /** Port to listen on (default: 3000) */
  port?: number;
  /** Host to bind to (default: localhost) */
  host?: string;
  /** Enable CORS (default: true) */
  cors?: boolean;
}
