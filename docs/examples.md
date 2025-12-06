# Examples

## Run a build and capture output

```typescript
import { TerminalManager } from 'term-mcp';

const session = TerminalManager.spawn({ cwd: '/path/to/project' });

const result = await session.runCommand('npm run build', {
  timeout: 120000,
});

if (result.completed) {
  console.log('Build succeeded');
} else {
  console.log('Build timed out');
}

console.log(result.output);
session.destroy();
```

## Interactive program (SSH)

```typescript
const session = TerminalManager.spawn();

session.write('ssh user@server\n');
await session.waitFor(/password:/i);
session.write('mypassword\n');
await session.waitFor(/\$\s*$/);

const result = await session.runCommand('uptime');
console.log(result.output);

session.write('exit\n');
session.destroy();
```

## Visible terminal for debugging

```typescript
// Opens a terminal window user can watch
const session = TerminalManager.spawn({ visible: true });

// AI controls terminal while user observes
await session.runCommand('npm test');
await session.runCommand('npm run lint');

// User can also type in the terminal
// Both see the same session
```

## Run multiple commands

```typescript
const session = TerminalManager.spawn();

const commands = ['pwd', 'whoami', 'date'];

for (const cmd of commands) {
  const result = await session.runCommand(cmd);
  console.log(`${cmd}: ${result.output.trim()}`);
}

session.destroy();
```

## Wait for specific output

```typescript
const session = TerminalManager.spawn();

session.write('npm start\n');

// Wait for server ready message
await session.waitFor(/listening on port \d+/i, {
  timeout: 30000,
});

console.log('Server started');

// Ctrl+C to stop
session.write('\x03');
session.destroy();
```

## Reopen closed window

```typescript
const session = TerminalManager.spawn({ visible: true });

// ... user closes the window ...

// Reopen it
session.openWindow();
```
