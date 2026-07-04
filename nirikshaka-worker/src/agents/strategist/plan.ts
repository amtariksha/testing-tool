import { complete, extractJson, loadPrompt } from "../../llm/client";
import type { AppModelDoc } from "../../schema/app-model";
import { testStrategySchema, type TestStrategyDoc } from "../../schema/strategy";

/**
 * LLM planning step: CONFIRMED model → coverage matrix. Sonnet, no
 * temperature (claude-sonnet-5 rejects it — client omits by default).
 */
export async function planStrategy(
  model: AppModelDoc
): Promise<{ strategy: TestStrategyDoc; costUsd: number }> {
  const system = await loadPrompt("strategist-plan");
  const projection = {
    features: model.features.map((f) => ({
      id: f.id,
      name: f.name,
      confidence: f.confidence,
      roles: f.roles,
      states: f.states,
      business_rules: f.business_rules,
      criticalPath: f.review?.criticalPath ?? false,
    })),
    flows: model.flows,
    coverage_boundaries: model.coverage_boundaries,
  };
  const result = await complete({
    tier: "sonnet",
    system,
    user: JSON.stringify(projection, null, 2),
    maxTokens: 8192,
  });
  const strategy = testStrategySchema.parse(extractJson(result.text));
  return { strategy, costUsd: result.costUsd };
}
