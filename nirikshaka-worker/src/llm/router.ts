/**
 * Model routing (implementation doc §5.3 / PRD v3 §7.2). Three tiers; agents
 * pick a tier by task complexity, escalating only when needed to control cost.
 */

export type ModelTier = "haiku" | "sonnet" | "opus";

export const MODEL_IDS: Record<ModelTier, string> = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-5",
  opus: "claude-opus-4-8",
};

// Per-million-token USD (input, output). Used for run cost accounting; keep in
// sync with pricing. Approximate — refine against billing.
export const MODEL_PRICING: Record<ModelTier, { input: number; output: number }> = {
  haiku: { input: 1.0, output: 5.0 },
  sonnet: { input: 3.0, output: 15.0 },
  opus: { input: 15.0, output: 75.0 },
};

export function modelId(tier: ModelTier): string {
  return MODEL_IDS[tier];
}

export function estimateCostUsd(
  tier: ModelTier,
  inputTokens: number,
  outputTokens: number
): number {
  const price = MODEL_PRICING[tier];
  return (
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output
  );
}
