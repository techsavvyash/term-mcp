# Testing Examples

Examples showing how to use Termwright for automated CLI testing and validation.

## Examples

### 1. CLI Testing (`testing-example.ts`)

Automated testing of command-line applications:

```typescript
import { TerminalManager } from "@termwright/core";

async function testCliApp() {
  const manager = TerminalManager;
  const session = manager.spawn({ cols: 80, rows: 24 });

  console.log("Testing CLI application...\n");

  // Test 1: Verify command exists
  try {
    const output = await session.runCommand("which node", { timeout: 2000 });
    console.log("✓ Node.js is installed:", output.trim());
  } catch (error) {
    console.log("✗ Node.js not found");
    session.destroy();
    return;
  }

  // Test 2: Check version
  const versionOutput = await session.runCommand("node --version", {
    timeout: 2000,
  });
  console.log(`✓ Node.js version: ${versionOutput.trim()}`);

  // Test 3: Run script and verify output
  session.write('node -e "console.log(\'Hello, World!\')"\n');
  const matched = await session.waitForPattern(/Hello, World!/, {
    timeout: 2000,
  });

  if (matched) {
    console.log("✓ Script execution successful");
  }

  // Test 4: Error handling
  session.write('node -e "throw new Error(\'Test error\')"\n');
  const errorMatched = await session.waitForPattern(/Error: Test error/, {
    timeout: 2000,
  });

  if (errorMatched) {
    console.log("✓ Error handling works correctly");
  }

  console.log("\nAll tests completed!");
  session.destroy();
}

testCliApp().catch(console.error);
```

**Key Concepts:**
- Test command availability with `which` or similar
- Verify command output matches expected patterns
- Test error conditions and edge cases
- Automate CLI testing workflows

**Run:**
```bash
npm run testing:cli
```

---

## Testing Patterns

### Test Structure

```typescript
async function testSuite() {
  const session = TerminalManager.spawn({ cols: 80, rows: 24 });

  try {
    // Setup
    await runSetup(session);

    // Run tests
    await test1(session);
    await test2(session);
    await test3(session);

    // Teardown
    await runTeardown(session);
  } finally {
    session.destroy();
  }
}
```

### Assertion Helpers

```typescript
async function assertCommandSucceeds(
  session: TerminalSession,
  command: string
) {
  const result = await session.runCommand(command, { timeout: 5000 });
  if (result.output.includes("error") || result.output.includes("failed")) {
    throw new Error(`Command failed: ${command}`);
  }
  return result;
}

async function assertOutputContains(
  session: TerminalSession,
  pattern: RegExp,
  timeout = 5000
) {
  const matched = await session.waitForPattern(pattern, { timeout });
  if (!matched) {
    throw new Error(`Expected pattern not found: ${pattern}`);
  }
  return matched;
}
```

### Integration Testing

```typescript
async function testApplication() {
  const session = TerminalManager.spawn({ cols: 80, rows: 24 });

  // 1. Install dependencies
  await session.runCommand("npm install", { timeout: 60000 });

  // 2. Run build
  await session.runCommand("npm run build", { timeout: 30000 });

  // 3. Run tests
  await session.runCommand("npm test", { timeout: 60000 });

  // 4. Verify output
  const output = session.readOutput();
  if (!output.includes("All tests passed")) {
    throw new Error("Tests failed");
  }

  session.destroy();
}
```

### Parallel Test Execution

```typescript
async function runTestsInParallel() {
  const testSuites = [
    () => testAuth(),
    () => testDatabase(),
    () => testAPI(),
  ];

  const sessions = testSuites.map(() =>
    TerminalManager.spawn({ cols: 80, rows: 24 })
  );

  try {
    const results = await Promise.all(
      testSuites.map((test, i) => test(sessions[i]))
    );
    console.log("All tests passed:", results);
  } finally {
    sessions.forEach((s) => s.destroy());
  }
}
```

## Use Cases

- **CLI Tool Testing**: Validate command-line applications
- **Installation Testing**: Test package installers and setup scripts
- **Integration Testing**: End-to-end testing of terminal-based workflows
- **Regression Testing**: Automated testing of terminal interactions
- **CI/CD Pipelines**: Automated terminal testing in build pipelines

## Best Practices

1. **Always Clean Up**: Use `try/finally` to ensure sessions are destroyed
2. **Set Timeouts**: Prevent tests from hanging indefinitely
3. **Verify Output**: Use pattern matching to validate expected behavior
4. **Test Edge Cases**: Include error conditions and failure scenarios
5. **Parallel Execution**: Run independent tests in parallel for speed

## Next Steps

- See [Getting Started](../getting-started/) for basic usage
- See [Advanced Examples](../advanced/) for complex scenarios
- Read the [Testing Guide](../../docs/testing-guide.md) for comprehensive testing strategies
