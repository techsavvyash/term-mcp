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
