import { describe, expect, it } from "vitest";
import { runPool } from "./pool";

describe("runPool", () => {
  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await runPool(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    });
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("preserves order and maps results by index", async () => {
    const out = await runPool([1, 2, 3, 4], 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });

  it("isolates a rejection to its own slot (siblings still run)", async () => {
    const out = await runPool([1, 2, 3], 3, async (n) => {
      if (n === 2) throw new Error("boom");
      return n;
    });
    expect(out).toEqual([1, null, 3]);
  });

  it("handles an empty list", async () => {
    expect(await runPool([], 2, async (n) => n)).toEqual([]);
  });
});
