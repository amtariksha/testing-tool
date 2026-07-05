import { describe, expect, it } from "vitest";
import { CostLedger, finalizeCaseStatus } from "./retry";
import type { CaseOutcome } from "./types";

const outcome = (status: CaseOutcome["status"], llmCostUsd = 0): CaseOutcome => ({
  status,
  durationMs: 100,
  usedFastPath: true,
  llmCalls: llmCostUsd > 0 ? 1 : 0,
  llmCostUsd,
  stepLog: [],
  screenshots: [],
});

describe("finalizeCaseStatus", () => {
  it("fail→pass = passed + flaky, costs summed across attempts", () => {
    const f = finalizeCaseStatus([outcome("failed", 0.02), outcome("passed", 0.03)]);
    expect(f.outcome.status).toBe("passed");
    expect(f.flaky).toBe(true);
    expect(f.attempts).toBe(2);
    expect(f.outcome.llmCostUsd).toBeCloseTo(0.05);
  });

  it("fail→fail = failed, not flaky, attempts counted", () => {
    const f = finalizeCaseStatus([outcome("failed"), outcome("failed")]);
    expect(f.outcome.status).toBe("failed");
    expect(f.flaky).toBe(false);
    expect(f.attempts).toBe(2);
  });

  it("single pass = passed, not flaky", () => {
    const f = finalizeCaseStatus([outcome("passed")]);
    expect(f.flaky).toBe(false);
    expect(f.attempts).toBe(1);
  });
});

describe("CostLedger", () => {
  it("trips at the cap and stops spending", () => {
    const ledger = new CostLedger(1.0);
    expect(ledger.add(0.6)).toBe(true);
    expect(ledger.canSpend()).toBe(true);
    expect(ledger.add(0.5)).toBe(false); // 1.1 ≥ 1.0
    expect(ledger.tripped).toBe(true);
    expect(ledger.canSpend()).toBe(false);
  });

  it("seeds from prior spend on resume", () => {
    const ledger = new CostLedger(1.0, 0.9);
    expect(ledger.canSpend()).toBe(true);
    expect(ledger.add(0.2)).toBe(false);
  });
});
