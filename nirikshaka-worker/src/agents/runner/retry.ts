import type { CaseOutcome } from "./types";

/**
 * Retry-once + flaky classification (doc §7 Phase 4) — pure. A case that
 * fails then passes on retry is a flaky pass; the verdict carries the flag so
 * the Analyst can quarantine chronic flakes.
 */
export interface FinalizedCase {
  outcome: CaseOutcome;
  flaky: boolean;
  attempts: number;
}

export function finalizeCaseStatus(attempts: CaseOutcome[]): FinalizedCase {
  const last = attempts[attempts.length - 1]!;
  const anyRetry = attempts.length > 1;
  const passedOnRetry = anyRetry && last.status === "passed" && attempts[0]!.status !== "passed";
  return {
    outcome: {
      ...last,
      llmCalls: attempts.reduce((n, a) => n + a.llmCalls, 0),
      llmCostUsd: attempts.reduce((n, a) => n + a.llmCostUsd, 0),
    },
    flaky: passedOnRetry,
    attempts: attempts.length,
  };
}

/**
 * Shared per-run cost ledger. Single-process ⇒ increments are race-free; the
 * cap is checked BEFORE each LLM call and `tripped` stops the pool dequeuing.
 */
export class CostLedger {
  private spent: number;
  tripped = false;

  constructor(
    private readonly capUsd: number,
    alreadySpent = 0
  ) {
    this.spent = alreadySpent;
  }

  get total(): number {
    return this.spent;
  }

  /** Returns true if there is still budget; false (and sets tripped) if not. */
  add(usd: number): boolean {
    this.spent += usd;
    if (this.spent >= this.capUsd) this.tripped = true;
    return !this.tripped;
  }

  canSpend(): boolean {
    return !this.tripped && this.spent < this.capUsd;
  }
}
