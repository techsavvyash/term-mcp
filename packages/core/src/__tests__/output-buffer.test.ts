import { describe, test, expect, beforeEach } from "vitest";
import { OutputBuffer } from "../utils/output-buffer";

describe("OutputBuffer", () => {
  let buffer: OutputBuffer;

  beforeEach(() => {
    buffer = new OutputBuffer();
  });

  describe("append and read", () => {
    test("should start empty", () => {
      expect(buffer.read()).toBe("");
      expect(buffer.length).toBe(0);
    });

    test("should append data", () => {
      buffer.append("hello");
      expect(buffer.read()).toBe("hello");
      expect(buffer.length).toBe(5);
    });

    test("should append multiple times", () => {
      buffer.append("hello ");
      buffer.append("world");
      expect(buffer.read()).toBe("hello world");
    });

    test("should read last N lines", () => {
      buffer.append("line1\nline2\nline3\nline4\nline5");
      expect(buffer.read({ lines: 2 })).toBe("line4\nline5");
      expect(buffer.read({ lines: 3 })).toBe("line3\nline4\nline5");
    });

    test("should clear buffer on read when clear option is true", () => {
      buffer.append("hello");
      const result = buffer.read({ clear: true });
      expect(result).toBe("hello");
      expect(buffer.read()).toBe("");
    });
  });

  describe("clear", () => {
    test("should clear the buffer", () => {
      buffer.append("hello");
      buffer.clear();
      expect(buffer.read()).toBe("");
      expect(buffer.length).toBe(0);
    });
  });

  describe("waitFor", () => {
    test("should resolve immediately if pattern exists", async () => {
      buffer.append("hello world");
      const result = await buffer.waitFor("world");
      expect(result).toBe("hello world");
    });

    test("should resolve when pattern appears later", async () => {
      const promise = buffer.waitFor("done");
      buffer.append("working...");
      buffer.append(" done!");
      const result = await promise;
      expect(result).toContain("done");
    });

    test("should work with regex patterns", async () => {
      buffer.append("error code: 42");
      const result = await buffer.waitFor(/code: \d+/);
      expect(result).toContain("code: 42");
    });

    test("should timeout if pattern never appears", async () => {
      const promise = buffer.waitFor("never", { timeout: 100 });
      await expect(promise).rejects.toThrow("Timeout waiting for pattern");
    });

    test("should clear buffer after match when clear option is true", async () => {
      buffer.append("hello world");
      await buffer.waitFor("world", { clear: true });
      expect(buffer.read()).toBe("");
    });

    test("should handle multiple concurrent waiters", async () => {
      const promise1 = buffer.waitFor("first");
      const promise2 = buffer.waitFor("second");

      buffer.append("first appears");
      const result1 = await promise1;
      expect(result1).toContain("first");

      buffer.append(" then second");
      const result2 = await promise2;
      expect(result2).toContain("second");
    });
  });

  describe("cancelAllWaiters", () => {
    test("should cancel pending waiters", async () => {
      const promise = buffer.waitFor("never", { timeout: 10000 });
      buffer.cancelAllWaiters();
      await expect(promise).rejects.toThrow("Buffer destroyed");
    });
  });
});
