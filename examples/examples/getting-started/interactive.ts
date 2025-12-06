import { TerminalManager } from "@termwright/core";

async function main() {
  const manager = TerminalManager;

  // Spawn a terminal session
  const session = manager.spawn({
    cols: 80,
    rows: 24,
  });

  console.log(`Session created: ${session.id}`);

  // Write directly to the terminal
  session.write("echo 'Starting interactive demo'\n");
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Read the output
  let output = session.readOutput();
  console.log("Output after echo:", output);

  // Start a Python REPL
  session.write("python3\n");
  await session.waitForPattern(/>>>/, { timeout: 5000 });
  console.log("Python REPL started");

  // Execute some Python code
  session.write("import sys\n");
  await new Promise((resolve) => setTimeout(resolve, 200));

  session.write("print(sys.version)\n");
  await new Promise((resolve) => setTimeout(resolve, 500));

  output = session.readOutput();
  console.log("Python version:", output);

  // Exit Python
  session.write("exit()\n");
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Clean up
  session.destroy();
  console.log("Session destroyed");
}

main().catch(console.error);
