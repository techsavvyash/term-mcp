import type { WaitOptions, ReadOptions } from "./types";

/**
 * OutputBuffer manages terminal output with pattern matching and waiting capabilities.
 * It stores output as it comes in and allows reading/searching through it.
 */
export class OutputBuffer {
  private buffer: string = "";
  private waiters: Array<{
    pattern: RegExp;
    resolve: (match: string) => void;
    reject: (error: Error) => void;
    timeoutId: NodeJS.Timeout;
  }> = [];

  /**
   * Append data to the buffer and check for any waiting patterns.
   */
  append(data: string): void {
    this.buffer += data;
    this.checkWaiters();
  }

  /**
   * Read the current buffer contents.
   */
  read(options: ReadOptions = {}): string {
    let result = this.buffer;

    if (options.lines !== undefined && options.lines > 0) {
      const lines = result.split("\n");
      result = lines.slice(-options.lines).join("\n");
    }

    if (options.clear) {
      this.buffer = "";
    }

    return result;
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.buffer = "";
  }

  /**
   * Get the current buffer length.
   */
  get length(): number {
    return this.buffer.length;
  }

  /**
   * Wait for a pattern to appear in the output.
   * @param pattern - String or RegExp to match
   * @param options - Wait options including timeout
   * @returns Promise that resolves with the matched content
   */
  waitFor(
    pattern: string | RegExp,
    options: WaitOptions = {}
  ): Promise<string> {
    const { timeout = 30000, clear = false } = options;
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

    // Check if pattern already exists in buffer
    const existingMatch = this.buffer.match(regex);
    if (existingMatch) {
      const result = this.buffer;
      if (clear) {
        this.buffer = "";
      }
      return Promise.resolve(result);
    }

    // Set up waiter for future data
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.waiters.findIndex((w) => w.resolve === resolve);
        if (index !== -1) {
          this.waiters.splice(index, 1);
        }
        reject(
          new Error(
            `Timeout waiting for pattern: ${pattern} (waited ${timeout}ms)`
          )
        );
      }, timeout);

      this.waiters.push({
        pattern: regex,
        resolve: (match: string) => {
          clearTimeout(timeoutId);
          if (clear) {
            this.buffer = "";
          }
          resolve(match);
        },
        reject,
        timeoutId,
      });
    });
  }

  /**
   * Check all waiters against current buffer content.
   */
  private checkWaiters(): void {
    const toRemove: number[] = [];

    this.waiters.forEach((waiter, index) => {
      if (waiter.pattern.test(this.buffer)) {
        toRemove.push(index);
        waiter.resolve(this.buffer);
      }
    });

    // Remove matched waiters in reverse order to preserve indices
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.waiters.splice(toRemove[i], 1);
    }
  }

  /**
   * Cancel all pending waiters.
   */
  cancelAllWaiters(): void {
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timeoutId);
      waiter.reject(new Error("Buffer destroyed"));
    }
    this.waiters = [];
  }
}
