import { execSync, spawn, ChildProcess } from "child_process";
import { OutputBuffer } from "../utils/output-buffer.js";
import type {
  SpawnOptions,
  SessionInfo,
  WaitOptions,
  ReadOptions,
  RunCommandResult,
} from "../types/index.js";

/**
 * Supported terminal emulators in order of preference.
 */
const TERMINAL_EMULATORS = [
  {
    name: "kitty",
    command: (session: string) => ["kitty", "-e", "tmux", "attach", "-t", session],
  },
  {
    name: "alacritty",
    command: (session: string) => ["alacritty", "-e", "tmux", "attach", "-t", session],
  },
  {
    name: "wezterm",
    command: (session: string) => ["wezterm", "start", "--", "tmux", "attach", "-t", session],
  },
  {
    name: "foot",
    command: (session: string) => ["foot", "tmux", "attach", "-t", session],
  },
  {
    name: "gnome-terminal",
    command: (session: string) => ["gnome-terminal", "--", "tmux", "attach", "-t", session],
  },
  {
    name: "konsole",
    command: (session: string) => ["konsole", "-e", "tmux", "attach", "-t", session],
  },
  {
    name: "xterm",
    command: (session: string) => ["xterm", "-e", "tmux", "attach", "-t", session],
  },
];

/**
 * Detect available terminal emulator.
 */
function detectTerminalEmulator(): typeof TERMINAL_EMULATORS[0] | null {
  for (const term of TERMINAL_EMULATORS) {
    try {
      execSync(`which ${term.name}`, { stdio: "ignore" });
      return term;
    } catch {
      // Not found, try next
    }
  }
  return null;
}

/**
 * TmuxSession creates a real tmux session that can be attached to
 * from any terminal window, providing a visible controlled terminal.
 *
 * When spawnWindow is true, it also spawns a terminal emulator window
 * attached to the session - like Puppeteer spawning a browser.
 */
export class TmuxSession {
  readonly id: string;
  readonly tmuxSessionName: string;
  readonly createdAt: Date;
  readonly cwd: string;

  private outputBuffer: OutputBuffer;
  private _alive: boolean = true;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastOutputLength: number = 0;
  private terminalProcess: ChildProcess | null = null;
  private _terminalEmulator: string | null = null;

  constructor(id: string, options: SpawnOptions = {}, spawnWindow: boolean = false) {
    this.id = id;
    this.tmuxSessionName = `termwright-${id}`;
    this.createdAt = new Date();
    this.cwd = options.cwd || process.cwd();
    this.outputBuffer = new OutputBuffer();

    // Check if tmux is available
    try {
      execSync("which tmux", { stdio: "ignore" });
    } catch {
      throw new Error("tmux is not installed. Please install tmux to use visible terminals.");
    }

    // Determine shell to use
    const shell =
      options.shell ||
      process.env.SHELL ||
      "/bin/bash";

    // Create tmux session
    const cols = options.cols || 120;
    const rows = options.rows || 40;

    try {
      // Kill any existing session with this name
      try {
        execSync(`tmux kill-session -t ${this.tmuxSessionName} 2>/dev/null`, { stdio: "ignore" });
      } catch {
        // Ignore - session might not exist
      }

      // Create new detached tmux session
      execSync(
        `tmux new-session -d -s ${this.tmuxSessionName} -x ${cols} -y ${rows} -c "${this.cwd}" "${shell}"`,
        { stdio: "ignore" }
      );

      // Set environment variables if provided
      if (options.env) {
        for (const [key, value] of Object.entries(options.env)) {
          execSync(`tmux setenv -t ${this.tmuxSessionName} ${key} "${value}"`, { stdio: "ignore" });
        }
      }

      // Spawn terminal window if requested
      if (spawnWindow) {
        this.openWindow();
      }

      // Start polling for output
      this.startOutputPolling();

    } catch (error) {
      this._alive = false;
      throw new Error(`Failed to create tmux session: ${error}`);
    }
  }

  /**
   * Spawn a terminal emulator window attached to this tmux session.
   * Can be called multiple times to reopen a closed window.
   */
  openWindow(): void {
    const terminal = detectTerminalEmulator();
    if (!terminal) {
      throw new Error(
        "No supported terminal emulator found. Please install one of: " +
        TERMINAL_EMULATORS.map(t => t.name).join(", ")
      );
    }

    this._terminalEmulator = terminal.name;
    const args = terminal.command(this.tmuxSessionName);

    // Build the command string for bash to execute
    const cmdString = args.map(arg =>
      arg.includes(' ') ? `"${arg}"` : arg
    ).join(' ');

    // Spawn via bash with background to ensure GUI apps work correctly
    // Direct spawn with detached: true doesn't work reliably for GUI apps
    this.terminalProcess = spawn('/bin/bash', ['-c', `${cmdString} &`], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });

    // Don't let the bash process keep the parent alive
    this.terminalProcess.unref();

    // Track if terminal window is closed
    this.terminalProcess.on("exit", () => {
      this.terminalProcess = null;
    });
  }

  /**
   * Get the terminal emulator being used.
   */
  get terminalEmulator(): string | null {
    return this._terminalEmulator;
  }

  /**
   * Poll tmux for new output and append to buffer.
   */
  private startOutputPolling(): void {
    this.pollInterval = setInterval(() => {
      if (!this._alive) {
        this.stopOutputPolling();
        return;
      }

      try {
        // Capture the entire pane content
        const output = execSync(
          `tmux capture-pane -t ${this.tmuxSessionName} -p -S -`,
          { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
        );

        // Only append new content
        if (output.length > this.lastOutputLength) {
          const newContent = output.slice(this.lastOutputLength);
          this.outputBuffer.append(newContent);
          this.lastOutputLength = output.length;
        }
      } catch {
        // Session might have been killed
        this._alive = false;
        this.stopOutputPolling();
      }
    }, 100); // Poll every 100ms
  }

  private stopOutputPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Get the tmux session name for attaching.
   */
  get sessionName(): string {
    return this.tmuxSessionName;
  }

  /**
   * Get the attach command for users.
   */
  get attachCommand(): string {
    return `tmux attach -t ${this.tmuxSessionName}`;
  }

  /**
   * Check if the session is still alive.
   */
  get alive(): boolean {
    if (!this._alive) return false;

    try {
      execSync(`tmux has-session -t ${this.tmuxSessionName} 2>/dev/null`, { stdio: "ignore" });
      return true;
    } catch {
      this._alive = false;
      return false;
    }
  }

  /**
   * Get session information.
   */
  getInfo(): SessionInfo & { tmuxSession: string; attachCommand: string; visible: true } {
    return {
      id: this.id,
      pid: 0, // tmux manages its own PIDs
      createdAt: this.createdAt,
      cwd: this.cwd,
      alive: this.alive,
      tmuxSession: this.tmuxSessionName,
      attachCommand: this.attachCommand,
      visible: true,
    };
  }

  /**
   * Write data to the terminal (send input via tmux send-keys).
   */
  write(data: string): void {
    if (!this.alive) {
      throw new Error(`Session ${this.id} is not alive`);
    }

    // Escape special characters for tmux send-keys
    // send-keys -l sends literal characters
    try {
      // For newlines, we need to send Enter separately
      const parts = data.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          execSync(`tmux send-keys -t ${this.tmuxSessionName} -l "${parts[i].replace(/"/g, '\\"')}"`, { stdio: "ignore" });
        }
        if (i < parts.length - 1) {
          execSync(`tmux send-keys -t ${this.tmuxSessionName} Enter`, { stdio: "ignore" });
        }
      }
    } catch (error) {
      throw new Error(`Failed to send input: ${error}`);
    }
  }

  /**
   * Read from the output buffer.
   */
  read(options: ReadOptions = {}): string {
    // Force a capture before reading
    try {
      const output = execSync(
        `tmux capture-pane -t ${this.tmuxSessionName} -p -S -`,
        { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
      );

      if (output.length > this.lastOutputLength) {
        const newContent = output.slice(this.lastOutputLength);
        this.outputBuffer.append(newContent);
        this.lastOutputLength = output.length;
      }
    } catch {
      // Ignore capture errors
    }

    return this.outputBuffer.read(options);
  }

  /**
   * Clear the output buffer.
   */
  clearBuffer(): void {
    this.outputBuffer.clear();
    this.lastOutputLength = 0;

    // Also clear the tmux pane
    try {
      execSync(`tmux send-keys -t ${this.tmuxSessionName} C-l`, { stdio: "ignore" });
    } catch {
      // Ignore
    }
  }

  /**
   * Wait for a pattern to appear in the output.
   */
  waitFor(pattern: string | RegExp, options: WaitOptions = {}): Promise<string> {
    return this.outputBuffer.waitFor(pattern, options);
  }

  /**
   * Run a command and wait for it to complete.
   */
  async runCommand(
    command: string,
    options: {
      timeout?: number;
      waitFor?: string | RegExp;
    } = {}
  ): Promise<RunCommandResult> {
    const { timeout = 30000 } = options;

    // Clear buffer before running command
    this.outputBuffer.clear();

    // Send the command
    this.write(command + "\n");

    const waitPattern =
      options.waitFor ||
      /[\$#>]\s*$/m;

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const output = await this.outputBuffer.waitFor(waitPattern, {
        timeout,
        clear: false,
      });
      return { output, completed: true };
    } catch (error) {
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
    try {
      execSync(`tmux resize-window -t ${this.tmuxSessionName} -x ${cols} -y ${rows}`, { stdio: "ignore" });
    } catch {
      // Ignore resize errors
    }
  }

  /**
   * Kill the tmux session.
   */
  kill(): void {
    if (this._alive) {
      this.stopOutputPolling();
      this.outputBuffer.cancelAllWaiters();

      try {
        execSync(`tmux kill-session -t ${this.tmuxSessionName}`, { stdio: "ignore" });
      } catch {
        // Ignore - session might already be dead
      }

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
