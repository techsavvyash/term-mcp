# Termwright Examples

Comprehensive examples demonstrating the `@termwright/core` library for programmatic terminal control.

## 📁 Example Categories

### [Getting Started](./getting-started/)

Fundamental examples for learning Termwright basics:
- **basic.ts** - Spawning sessions, running commands, basic I/O
- **interactive.ts** - Working with interactive programs (REPLs, prompts)

```bash
npm run getting-started:basic
npm run getting-started:interactive
```

### [Advanced Usage](./advanced/)

Complex scenarios and advanced features:
- **pattern-matching.ts** - Regex patterns, conditional execution, async waiting
- **multi-session.ts** - Parallel execution, session management, resource pooling

```bash
npm run advanced:pattern-matching
npm run advanced:multi-session
```

### [Testing](./testing/)

Using Termwright for automated testing:
- **testing-example.ts** - CLI testing, validation, error handling

```bash
npm run testing:cli
```

## 🚀 Quick Start

1. **Install dependencies** (from repository root):
   ```bash
   npm install
   ```

2. **Build the core library** (required first time):
   ```bash
   npm run build
   ```

3. **Run any example**:
   ```bash
   npm run getting-started:basic
   ```

## 📖 Documentation Structure

```
examples/
├── README.md                    # This file
├── getting-started/
│   ├── README.md               # Getting started guide
│   ├── basic.ts                # Basic usage
│   └── interactive.ts          # Interactive sessions
├── advanced/
│   ├── README.md               # Advanced patterns guide
│   ├── pattern-matching.ts    # Pattern matching
│   └── multi-session.ts       # Multi-session management
└── testing/
    ├── README.md               # Testing guide
    └── testing-example.ts     # CLI testing example
```

## 🔑 Key Concepts

### TerminalManager (Singleton)

```typescript
import { TerminalManager } from "@termwright/core";

// TerminalManager is a singleton - use directly (no 'new')
const session = TerminalManager.spawn({
  cols: 80,
  rows: 24,
  cwd: process.cwd(),
});
```

### Session Lifecycle

```typescript
// Spawn
const session = TerminalManager.spawn({ cols: 80, rows: 24 });

// Use
await session.runCommand("echo 'hello'", { timeout: 5000 });

// Always destroy when done
session.destroy();
```

### Command Execution

```typescript
// One-shot command (waits for completion)
const result = await session.runCommand("ls -la", { timeout: 5000 });
console.log(result.output);

// Interactive input/output
session.write("python3\n");
await session.waitForPattern(/>>>/);
session.write("print('hello')\n");
const output = session.readOutput();
```

### Pattern Matching

```typescript
// Wait for specific output
await session.waitForPattern(/COMPLETE/, { timeout: 5000 });

// Handle multiple outcomes
const output = await session.waitForPattern(/SUCCESS|FAILED/);
if (output.includes("SUCCESS")) {
  // Handle success
}
```

## 📚 Learn More

- **[Getting Started Guide](./getting-started/README.md)** - Start here if you're new
- **[Advanced Guide](./advanced/README.md)** - Complex scenarios and patterns
- **[Testing Guide](./testing/README.md)** - Automated testing strategies
- **[API Reference](../docs/api-reference.md)** - Complete API documentation
- **[Core Library Docs](../packages/core/README.md)** - Core library details
- **[MCP Server Docs](../packages/mcp-server/README.md)** - MCP integration

## 💡 Common Use Cases

| Use Case | Example | Category |
|----------|---------|----------|
| Run a simple command | `basic.ts` | Getting Started |
| Interactive CLI tools | `interactive.ts` | Getting Started |
| Wait for specific output | `pattern-matching.ts` | Advanced |
| Parallel execution | `multi-session.ts` | Advanced |
| Test CLI applications | `testing-example.ts` | Testing |

## 🛠 Troubleshooting

**Import Error**: Make sure to build the core library first:
```bash
npm run build --workspace=@termwright/core
```

**Session hangs**: Always set timeouts on async operations:
```typescript
await session.runCommand("cmd", { timeout: 5000 });
await session.waitForPattern(/pattern/, { timeout: 3000 });
```

**Memory leaks**: Always destroy sessions when done:
```typescript
try {
  // Use session
} finally {
  session.destroy();
}
```
