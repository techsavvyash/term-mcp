import { TerminalManager } from "@termwright/core";

async function main() {
  const manager = TerminalManager;

  // Spawn a new terminal session
  const session = manager.spawn({
    cols: 80,
    rows: 24,
    cwd: process.cwd(),
  });

  console.log(`Session created: ${session.id}`);

  // Run a simple command
  const output = await session.runCommand("echo 'Hello from Termwright!'", {
    timeout: 5000,
  });

  console.log("Command output:", output);

  // List files in current directory
  const lsOutput = await session.runCommand("ls -la", { timeout: 5000 });
  console.log("Directory listing:", lsOutput);

  // Clean up
  session.destroy();
  console.log("Session destroyed");
}

main().catch(console.error);
