# Advanced Examples

These examples demonstrate advanced Termwright features for complex automation scenarios.

## Examples

### 1. Pattern Matching (`pattern-matching.ts`)

Advanced pattern matching and waiting for specific output:

```typescript
import { TerminalManager } from "@termwright/core";

async function main() {
  const manager = TerminalManager;
  const session = manager.spawn({ cols: 80, rows: 24 });

  // Wait for task completion
  session.write("echo 'TASK_START'\n");
  session.write("sleep 2\n");
  session.write("echo 'TASK_COMPLETE'\n");

  const matched = await session.waitForPattern(/TASK_COMPLETE/, {
    timeout: 5000,
  });

  if (matched) {
    console.log("Task completed successfully!");
  }

  // Wait for multiple possible patterns
  session.write("git status\n");
  await session.waitForPattern(/On branch|Not a git repository/, {
    timeout: 2000,
  });

  const output = session.readOutput();
  console.log("Git status:", output);

  session.destroy();
}

main().catch(console.error);
```

**Key Concepts:**
- `waitForPattern()` accepts regex patterns
- Can wait for multiple possible outcomes using regex alternation
- Useful for conditional logic based on command output
- Handles asynchronous command completion

**Run:**
```bash
npm run advanced:pattern-matching
```

---

### 2. Multi-Session Management (`multi-session.ts`)

Managing multiple terminal sessions in parallel:

```typescript
import { TerminalManager } from "@termwright/core";

async function main() {
  const manager = TerminalManager;

  // Spawn multiple sessions
  const session1 = manager.spawn({ cols: 80, rows: 24 });
  const session2 = manager.spawn({ cols: 80, rows: 24 });
  const session3 = manager.spawn({ cols: 80, rows: 24 });

  // Run commands in parallel
  const results = await Promise.all([
    session1.runCommand("echo 'Session 1: $(date)'", { timeout: 2000 }),
    session2.runCommand("echo 'Session 2: $(whoami)'", { timeout: 2000 }),
    session3.runCommand("echo 'Session 3: $(pwd)'", { timeout: 2000 }),
  ]);

  console.log("Results:", results);

  // List all active sessions
  const allSessions = manager.list();
  console.log(`Active sessions: ${allSessions.length}`);

  // Clean up all sessions
  session1.destroy();
  session2.destroy();
  session3.destroy();
}

main().catch(console.error);
```

**Key Concepts:**
- Create multiple independent terminal sessions
- Use `Promise.all()` for parallel command execution
- `manager.list()` returns all active sessions
- Each session runs in its own PTY process

**Use Cases:**
- Running multiple build processes simultaneously
- Parallel test execution
- Monitoring multiple services
- Distributed task execution

**Run:**
```bash
npm run advanced:multi-session
```

---

## Advanced Patterns

### Conditional Execution Based on Output

```typescript
session.write("command\n");
const output = await session.waitForPattern(/SUCCESS|FAILED/);

if (output.includes("SUCCESS")) {
  console.log("Command succeeded");
  // Continue with next steps
} else {
  console.log("Command failed");
  // Handle error
}
```

### Timeout Handling

```typescript
try {
  await session.waitForPattern(/expected/, { timeout: 5000 });
} catch (error) {
  console.error("Timeout waiting for pattern");
  // Handle timeout
}
```

### Session Pool Management

```typescript
const sessions = [];
for (let i = 0; i < 10; i++) {
  sessions.push(manager.spawn({ cols: 80, rows: 24 }));
}

// Use sessions...

// Cleanup all
sessions.forEach((s) => s.destroy());
```

## Next Steps

- See [Testing Examples](../testing/) for automated testing use cases
- Read the [Pattern Matching Guide](../../docs/pattern-matching.md) for more details
- Check the [API Reference](../../docs/api-reference.md) for all available methods
