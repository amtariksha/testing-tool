/**
 * Pure run-budget accounting (doc §5.3 / PRD §6.3 budget gate). Immutable:
 * charge() returns a new budget so the run loop's accounting is auditable.
 */

export interface CostBudget {
  capUsd: number;
  spentUsd: number;
}

export function createBudget(capUsd: number, alreadySpentUsd = 0): CostBudget {
  return { capUsd, spentUsd: alreadySpentUsd };
}

export function charge(budget: CostBudget, usd: number): CostBudget {
  return { ...budget, spentUsd: budget.spentUsd + usd };
}

export function isExceeded(budget: CostBudget): boolean {
  return budget.spentUsd >= budget.capUsd;
}

/** Round for Decimal(10,4) columns. */
export function toDecimal4(usd: number): number {
  return Math.round(usd * 10_000) / 10_000;
}
