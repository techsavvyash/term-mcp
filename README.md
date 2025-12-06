# termwright

Puppeteer for terminals. Programmatic terminal control for AI agents via MCP.

## What it does

Spawn terminal sessions, send commands, read output, and control interactive programs. Supports both headless (PTY) and visible (tmux + terminal emulator) modes.

## Installation

```bash
npm install termwright
# or
bun add termwright
```

## Quick Start

### As MCP Server

Add to your Claude config:

```json
{
  "mcpServers": {
    "termwright": {
      "command": "npx",
      "args": ["termwright"]
    }
  }
}
```

### Programmatic Usage

```typescript
import { TerminalManager } from 'termwright';

// Headless terminal
const session = TerminalManager.spawn();
const result = await session.runCommand('ls -la');
console.log(result.output);

// Visible terminal (opens window)
const visible = TerminalManager.spawn({ visible: true });
visible.write('echo hello\n');
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `spawn-terminal` | Create new terminal session |
| `send-input` | Send keystrokes to terminal |
| `run-command` | Execute command and wait for output |
| `read-output` | Read terminal output buffer |
| `wait-for-pattern` | Wait for regex match in output |
| `list-sessions` | List active sessions |
| `close-terminal` | Kill session |
| `open-terminal-window` | Open/reopen window for visible session |

## Visible Terminals

With `visible: true`, termwright creates a tmux session and spawns a terminal emulator window attached to it. Both AI and user can see and interact with the same terminal.

Supported terminal emulators: kitty, alacritty, wezterm, foot, gnome-terminal, konsole, xterm.

Requirements: `tmux` must be installed.

## Documentation

See [docs/](./docs/) for detailed documentation.

## License

MIT
