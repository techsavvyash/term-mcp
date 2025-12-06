# API Reference

## TerminalManager

Singleton that manages all terminal sessions.

### spawn(options?)

Create a new terminal session.

```typescript
const session = TerminalManager.spawn({
  shell: '/bin/zsh',      // Shell to use (default: $SHELL or /bin/bash)
  cwd: '/path/to/dir',    // Working directory
  cols: 120,              // Terminal width (default: 80)
  rows: 40,               // Terminal height (default: 24)
  env: { FOO: 'bar' },    // Additional environment variables
  visible: true,          // Open terminal window (requires tmux)
});
```

### get(sessionId)

Get session by ID. Returns `undefined` if not found.

### getOrThrow(sessionId)

Get session by ID. Throws if not found.

### list()

List all sessions. Returns `SessionInfo[]`.

### destroy(sessionId)

Destroy a session by ID. Returns `boolean`.

### destroyAll()

Destroy all sessions.

---

## Session Methods

### write(data)

Send raw input to terminal.

```typescript
session.write('ls -la\n');
session.write('\x03');  // Ctrl+C
```

### read(options?)

Read output buffer.

```typescript
const output = session.read();
const lastLines = session.read({ lines: 10 });
const cleared = session.read({ clear: true });
```

### runCommand(command, options?)

Execute command and wait for completion.

```typescript
const result = await session.runCommand('npm install', {
  timeout: 60000,
  waitFor: /\$\s*$/,  // Custom prompt pattern
});
// result: { output: string, completed: boolean }
```

### waitFor(pattern, options?)

Wait for pattern in output.

```typescript
await session.waitFor(/Password:/);
session.write('secret\n');
```

### resize(cols, rows)

Resize terminal.

### kill()

Kill the session.

### openWindow()

Open terminal window (visible sessions only).

---

## SessionInfo

```typescript
interface SessionInfo {
  id: string;
  pid: number;
  createdAt: Date;
  cwd: string;
  alive: boolean;
  visible?: boolean;
  tmuxSession?: string;
  attachCommand?: string;
}
```
