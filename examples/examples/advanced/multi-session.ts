import { TerminalManager } from "@termwright/core";

async function main() {
  const manager = TerminalManager;

  // Spawn multiple terminal sessions
  const session1 = manager.spawn({ cols: 80, rows: 24 });
  const session2 = manager.spawn({ cols: 80, rows: 24 });
  const session3 = manager.spawn({ cols: 80, rows: 24 });

  console.log("Created 3 terminal sessions");
  console.log(`Session IDs: ${session1.id}, ${session2.id}, ${session3.id}`);

  // Run commands in parallel
  const commands = [
    session1.runCommand("echo 'Session 1: $(date)'", { timeout: 2000 }),
    session2.runCommand("echo 'Session 2: $(whoami)'", { timeout: 2000 }),
    session3.runCommand("echo 'Session 3: $(pwd)'", { timeout: 2000 }),
  ];

  const results = await Promise.all(commands);

  console.log("\nResults from parallel execution:");
  results.forEach((result, index) => {
    // Extract the actual command output from the result
    const output = typeof result === "string" ? result : result.output || "";
    const lines = output.split("\n");
    // Find the line with "Session X:"
    const sessionLine = lines.find((line) => line.includes(`Session ${index + 1}:`));
    console.log(`Session ${index + 1}:`, sessionLine || output);
  });

  // List all active sessions
  const allSessions = manager.list();
  console.log(`\nActive sessions: ${allSessions.length}`);
  allSessions.forEach((s) => {
    console.log(`  - ${s.id} (PID: ${s.pid})`);
  });

  // Close all sessions
  session1.destroy();
  session2.destroy();
  session3.destroy();

  console.log("\nAll sessions destroyed");
}

main().catch(console.error);
