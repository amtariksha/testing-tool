import { describe, expect, it } from "vitest";
import { shouldRunAnalysis } from "./scheduler";

const at = (hour: number) => new Date(2026, 6, 5, hour, 0, 0);

describe("shouldRunAnalysis", () => {
  it("runs at the anchor hour when no prior run", () => {
    expect(shouldRunAnalysis(at(3), 3, null)).toBe(true);
  });

  it("does not run outside the anchor hour", () => {
    expect(shouldRunAnalysis(at(8), 3, null)).toBe(false);
    expect(shouldRunAnalysis(at(2), 3, null)).toBe(false);
  });

  it("does not double-run within the min-gap window", () => {
    const lastRun = at(3);
    // same hour next tick, only minutes later
    expect(shouldRunAnalysis(new Date(2026, 6, 5, 3, 20), 3, lastRun)).toBe(false);
  });

  it("runs again after the gap elapses (next day at anchor)", () => {
    const yesterday = at(3);
    const today = new Date(2026, 6, 6, 3, 0);
    expect(shouldRunAnalysis(today, 3, yesterday)).toBe(true);
  });

  it("respects a shorter gap that has not elapsed", () => {
    const fiveHoursAgo = new Date(2026, 6, 5, 3, 0);
    // anchor hour 3 but a run happened 5h earlier same day is impossible;
    // model a 21h anchor with a run 5h prior instead
    expect(shouldRunAnalysis(new Date(2026, 6, 5, 21, 0), 21, new Date(2026, 6, 5, 16, 0))).toBe(
      false
    );
  });
});
