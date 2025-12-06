import { TerminalManager } from "@termwright/core";

/**
 * Example: Testing a CLI application
 * This demonstrates how to use Termwright for automated testing of CLI tools
 */
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
  const version = versionOutput.trim();
  console.log(`✓ Node.js version: ${version}`);

  // Test 3: Run a script and verify output
  session.write("node -e \"console.log('Hello, World!')\"\n");
  const matched = await session.waitForPattern(/Hello, World!/, {
    timeout: 2000,
  });

  if (matched) {
    console.log("✓ Script execution successful");
  } else {
    console.log("✗ Script execution failed");
  }

  // Test 4: Test error handling
  session.write("node -e \"throw new Error('Test error')\"\n");
  const errorMatched = await session.waitForPattern(/Error: Test error/, {
    timeout: 2000,
  });

  if (errorMatched) {
    console.log("✓ Error handling works correctly");
  } else {
    console.log("✗ Error handling test failed");
  }

  // Test 5: Verify exit codes
  const exitCodeTest = await session.runCommand("exit 0 || echo FAILED", {
    timeout: 1000,
  });

  if (!exitCodeTest.includes("FAILED")) {
    console.log("✓ Exit code handling works");
  } else {
    console.log("✗ Exit code test failed");
  }

  console.log("\nAll tests completed!");
  session.destroy();
}

testCliApp().catch(console.error);
