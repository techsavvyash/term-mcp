import { TerminalManager } from "@termwright/core";

async function main() {
  const manager = TerminalManager;

  const session = manager.spawn({
    cols: 80,
    rows: 24,
  });

  console.log(`Session created: ${session.id}`);

  // Example 1: Wait for command completion
  session.write("echo 'TASK_START'\n");
  session.write("sleep 2\n");
  session.write("echo 'TASK_COMPLETE'\n");

  console.log("Waiting for task completion...");
  const matched = await session.waitForPattern(/TASK_COMPLETE/, {
    timeout: 5000,
  });

  if (matched) {
    console.log("Task completed successfully!");
  }

  // Example 2: Wait for multiple patterns
  session.write(
    "echo 'Processing...'; sleep 1; echo 'Status: SUCCESS' || echo 'Status: FAILED'\n"
  );

  const output = await session.waitForPattern(/Status: (SUCCESS|FAILED)/, {
    timeout: 3000,
  });

  if (output) {
    const match = output.match(/Status: (\w+)/);
    if (match) {
      console.log(`Process finished with status: ${match[1]}`);
    }
  }

  // Example 3: Git operations with pattern matching
  session.write("git status\n");
  await session.waitForPattern(/On branch|Not a git repository/, {
    timeout: 2000,
  });

  const gitOutput = session.readOutput();
  if (gitOutput.includes("On branch")) {
    console.log("In a git repository");
  } else {
    console.log("Not in a git repository");
  }

  // Clean up
  session.destroy();
  console.log("Session destroyed");
}

main().catch(console.error);
