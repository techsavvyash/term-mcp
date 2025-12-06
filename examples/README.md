# Termwright Examples

This directory contains examples demonstrating how to use the `@termwright/core` library for programmatic terminal control.

## Examples

### 1. Basic Usage (`basic.ts`)

Demonstrates the fundamentals:
- Spawning a terminal session
- Running simple commands
- Reading command output
- Destroying sessions

```bash
npm run basic
```

### 2. Interactive Session (`interactive.ts`)

Shows how to interact with long-running processes:
- Writing to the terminal
- Reading output
- Working with interactive programs (Python REPL)
- Pattern matching for prompts

```bash
npm run interactive
```

### 3. Pattern Matching (`pattern-matching.ts`)

Demonstrates advanced pattern matching:
- Waiting for specific output patterns
- Using regex patterns
- Handling multiple possible outcomes
- Real-world examples with git commands

```bash
npm run pattern-matching
```

### 4. Multi-Session Management (`multi-session.ts`)

Shows how to manage multiple terminal sessions:
- Spawning multiple sessions
- Running commands in parallel
- Listing active sessions
- Managing session lifecycle

```bash
npm run multi-session
```

### 5. Testing CLI Applications (`testing-example.ts`)

Example of using Termwright for automated testing:
- Verifying command availability
- Testing command output
- Error handling verification
- Exit code testing

```bash
npm run testing
```

## Setup

Install dependencies from the root of the monorepo:

```bash
npm install
```

## Running Examples

From the examples directory:

```bash
npm run basic
npm run interactive
npm run pattern-matching
npm run multi-session
npm run testing
```

Or run directly with tsx:

```bash
npx tsx basic.ts
npx tsx interactive.ts
# etc.
```

## Key Concepts

### Spawning Sessions

```typescript
const manager = new TerminalManager();
const session = manager.spawn({
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
});
```

### Running Commands

```typescript
// Run and wait for completion
const output = await session.runCommand("ls -la", { timeout: 5000 });

// Write interactively
session.write("echo 'hello'\n");
```

### Pattern Matching

```typescript
// Wait for specific output
await session.waitForPattern(/>>>/, { timeout: 5000 });

// Check for multiple patterns
const output = await session.waitForPattern(/SUCCESS|FAILED/, {
  timeout: 3000,
});
```

### Reading Output

```typescript
// Read all available output
const output = session.readOutput();

// Clear the buffer
session.readOutput(true);
```

## Learn More

- [Core Library Documentation](../packages/core/README.md)
- [MCP Server Documentation](../packages/mcp-server/README.md)
- [API Reference](../packages/core/src/index.ts)
