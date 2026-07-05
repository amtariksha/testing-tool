/**
 * Cost-outlier detection (doc §7 Phase 4) — pure. z-score with a zero-
 * variance guard AND an absolute floor so micro-costs never register as
 * outliers.
 */

export interface CostSample {
  caseId: string;
  externalId: string;
  llmCostUsd: number;
}

export interface CostOutlier extends CostSample {
  z: number;
}

export function findCostOutliers(
  samples: CostSample[],
  opts: { z: number; minUsd: number }
): CostOutlier[] {
  if (samples.length < 3) return [];
  const costs = samples.map((s) => s.llmCostUsd);
  const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
  const variance = costs.reduce((a, b) => a + (b - mean) ** 2, 0) / costs.length;
  const std = Math.sqrt(variance);
  if (std === 0) return []; // all equal — no outliers

  return samples
    .map((s) => ({ ...s, z: (s.llmCostUsd - mean) / std }))
    .filter((s) => s.z >= opts.z && s.llmCostUsd >= opts.minUsd)
    .sort((a, b) => b.z - a.z);
}
