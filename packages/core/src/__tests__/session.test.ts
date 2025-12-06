import { describe, test, expect, afterEach } from "vitest";
import { TerminalSession } from "../sessions/session";

describe("TerminalSession", () => {
  let session: TerminalSession | null = null;

  afterEach(() => {
    if (session) {
      session.destroy();
      session = null;
    }
  });

  describe("constructor", () => {
    test("should create session with default options", () => {
      session = new TerminalSession("test-id");
      expect(session.id).toBe("test-id");
      expect(session.alive).toBe(true);
    });

    test("should create session with custom cwd", () => {
      session = new TerminalSession("test-id", { cwd: "/tmp" });
      expect(session.cwd).toBe("/tmp");
    });
  });

  describe("getInfo", () => {
    test("should return session info", () => {
      session = new TerminalSession("test-id");
      const info = session.getInfo();

      expect(info.id).toBe("test-id");
      expect(info.pid).toBeGreaterThan(0);
      expect(info.alive).toBe(true);
      expect(info.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("write and read", () => {
    test("should write and read from terminal", async () => {
      session = new TerminalSession("test-id");

      // Wait for shell to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Write a simple echo command
      session.write("echo 'test-output-12345'\n");

      // Wait for output
      await new Promise((resolve) => setTimeout(resolve, 500));

      const output = session.read();
      expect(output).toContain("test-output-12345");
    });
  });

  describe("runCommand", () => {
    test("should run command and return output", async () => {
      session = new TerminalSession("test-id");

      // Wait for shell to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));

      const result = await session.runCommand("echo hello", { timeout: 5000 });
      expect(result.output).toContain("hello");
    });

    test("should handle command timeout", async () => {
      session = new TerminalSession("test-id");

      // Wait for shell to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Run a command that won't produce a prompt quickly
      const result = await session.runCommand("sleep 10", { timeout: 100 });
      expect(result.completed).toBe(false);
    });
  });

  describe("waitFor", () => {
    test("should wait for pattern in output", async () => {
      session = new TerminalSession("test-id");

      // Wait for shell to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));

      session.write("echo 'MARKER_ABC'\n");

      const output = await session.waitFor("MARKER_ABC", { timeout: 5000 });
      expect(output).toContain("MARKER_ABC");
    });
  });

  describe("resize", () => {
    test("should resize terminal without error", () => {
      session = new TerminalSession("test-id");
      expect(() => session!.resize(120, 40)).not.toThrow();
    });
  });

  describe("destroy", () => {
    test("should destroy session", () => {
      session = new TerminalSession("test-id");
      session.destroy();
      expect(session.alive).toBe(false);
      session = null; // Prevent afterEach from double-destroying
    });
  });
});
