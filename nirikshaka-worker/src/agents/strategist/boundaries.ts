import type { AppModelDoc } from "../../schema/app-model";
import type { TestStrategyDoc } from "../../schema/strategy";

/**
 * Safety boundary enforcement (doc §7 Phase 3): every feature the model
 * routes to coverage_boundaries.needs_human is forced to skipAgent — the LLM
 * is instructed to respect this, but the boundary is never trusted to it.
 * Pure and unit-tested.
 */
export function applyBoundaries(strategy: TestStrategyDoc, model: AppModelDoc): TestStrategyDoc {
  const needsHuman = new Set(model.coverage_boundaries.needs_human);
  if (needsHuman.size === 0) return strategy;

  const coverage = strategy.coverage.map((entry) =>
    needsHuman.has(entry.featureId)
      ? {
          ...entry,
          skipAgent: true,
          reason: entry.reason ?? "coverage_boundaries.needs_human (low confidence)",
        }
      : entry
  );
  const skipAgent = [...new Set([...strategy.skip_agent, ...needsHuman])];

  return { ...strategy, coverage, skip_agent: skipAgent };
}
