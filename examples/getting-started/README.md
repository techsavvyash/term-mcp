# Getting Started Examples

These examples demonstrate the basic usage of Termwright for terminal automation.

## Examples

### 1. Basic Usage (`basic.ts`)

The most fundamental example showing core Termwright features:

```typescript
import { TerminalManager } from "@termwright/core";

async function main() {
  const manager = TerminalManager;

  // Spawn a terminal session
  const session = manager.spawn({
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
  });

  // Run a command
  const output = await session.runCommand("echo 'Hello from Termwright!'", {
    timeout: 5000,
  });

  console.log("Command output:", output);

  // Clean up
  session.destroy();
}

main().catch(console.error);
```

**Key Concepts:**
- TerminalManager is a singleton instance (use directly, no `new`)
- `spawn()` creates a new terminal session
- `runCommand()` executes a command and waits for completion
- Always `destroy()` sessions when done

**Run:**
```bash
npm run getting-started:basic
```

---

### 2. Interactive Sessions (`interactive.ts`)

Working with interactive programs that require multiple inputs:

```typescript
import { TerminalManager } from "@termwright/core";

async function main() {
  const manager = TerminalManager;
  const session = manager.spawn({ cols: 80, rows: 24 });

  // Start Python REPL
  session.write("python3\n");
  await session.waitForPattern(/>>>/, { timeout: 5000 });
  console.log("Python REPL started");

  // Execute Python code
  session.write("print('Hello from Python')\n");
  await new Promise((resolve) => setTimeout(resolve, 500));

  const output = session.readOutput();
  console.log("Python output:", output);

  // Exit Python
  session.write("exit()\n");
  session.destroy();
}

main().catch(console.error);
```

**Key Concepts:**
- `write()` sends input to the terminal
- `waitForPattern()` waits for specific output (using regex)
- `readOutput()` retrieves all available output
- Useful for REPLs, interactive installers, prompts

**Run:**
```bash
npm run getting-started:interactive
```

---

## Common Patterns

### Spawning a Session

```typescript
const session = TerminalManager.spawn({
  cols: 80,      // Terminal columns
  rows: 24,      // Terminal rows
  cwd: "/path",  // Working directory
  env: {},       // Environment variables
});
```

### Running Commands

```typescript
// One-shot command execution
const result = await session.runCommand("ls -la", { timeout: 5000 });
console.log(result.output);

// Interactive input
session.write("command\n");
await session.waitForPattern(/expected output/);
const output = session.readOutput();
```

### Cleanup

```typescript
// Always destroy sessions when done
session.destroy();

// Or let TerminalManager handle it (cleanup on process exit)
```

## Next Steps

- See [Advanced Examples](../advanced/) for pattern matching and multi-session management
- See [Testing Examples](../testing/) for using Termwright in automated tests
- Read the [API Documentation](../../docs/api-reference.md) for complete details
