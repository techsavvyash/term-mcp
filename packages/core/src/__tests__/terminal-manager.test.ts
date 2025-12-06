import { describe, test, expect, afterEach } from "vitest";
import { TerminalManager } from "../managers/terminal-manager";

describe("TerminalManager", () => {
  const sessions: string[] = [];

  afterEach(() => {
    // Clean up all sessions created during tests
    for (const id of sessions) {
      try {
        TerminalManager.destroy(id);
      } catch {
        // Ignore cleanup errors
      }
    }
    sessions.length = 0;
  });

  describe("spawn", () => {
    test("should spawn a headless session", () => {
      const session = TerminalManager.spawn();
      sessions.push(session.id);

      expect(session.id).toBeDefined();
      expect(typeof session.id).toBe("string");
      expect(session.id.length).toBeGreaterThan(0);
    });

    test("should spawn with custom working directory", () => {
      const session = TerminalManager.spawn({ cwd: "/tmp" });
      sessions.push(session.id);

      expect(session.cwd).toBe("/tmp");
    });

    test("should spawn with custom shell", () => {
      const session = TerminalManager.spawn({ shell: "/bin/sh" });
      sessions.push(session.id);

      expect(session).toBeDefined();
    });
  });

  describe("get", () => {
    test("should return session by id", () => {
      const session = TerminalManager.spawn();
      sessions.push(session.id);

      const retrieved = TerminalManager.get(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });

    test("should return undefined for non-existent session", () => {
      const retrieved = TerminalManager.get("non-existent-id");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("getOrThrow", () => {
    test("should return session by id", () => {
      const session = TerminalManager.spawn();
      sessions.push(session.id);

      const retrieved = TerminalManager.getOrThrow(session.id);
      expect(retrieved.id).toBe(session.id);
    });

    test("should throw for non-existent session", () => {
      expect(() => TerminalManager.getOrThrow("non-existent-id")).toThrow(
        "Session not found: non-existent-id"
      );
    });
  });

  describe("list", () => {
    test("should return empty array when no sessions", () => {
      // Ensure clean state
      TerminalManager.destroyAll();
      const list = TerminalManager.list();
      expect(list).toEqual([]);
    });

    test("should return all active sessions", () => {
      const session1 = TerminalManager.spawn();
      const session2 = TerminalManager.spawn();
      sessions.push(session1.id, session2.id);

      const list = TerminalManager.list();
      expect(list.length).toBeGreaterThanOrEqual(2);
      expect(list.some((s) => s.id === session1.id)).toBe(true);
      expect(list.some((s) => s.id === session2.id)).toBe(true);
    });
  });

  describe("destroy", () => {
    test("should destroy session and return true", () => {
      const session = TerminalManager.spawn();
      const result = TerminalManager.destroy(session.id);

      expect(result).toBe(true);
      expect(TerminalManager.get(session.id)).toBeUndefined();
    });

    test("should return false for non-existent session", () => {
      const result = TerminalManager.destroy("non-existent-id");
      expect(result).toBe(false);
    });
  });

  describe("destroyAll", () => {
    test("should destroy all sessions", () => {
      TerminalManager.spawn();
      TerminalManager.spawn();

      TerminalManager.destroyAll();

      expect(TerminalManager.list()).toEqual([]);
    });
  });
});
