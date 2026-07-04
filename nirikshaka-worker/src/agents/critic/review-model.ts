import { z } from "zod";
import { complete, extractJson, loadPrompt } from "../../llm/client";
import type { AppModelDoc } from "../../schema/app-model";

/**
 * Critic's model review (implementation doc §7 Phase 1, Critic v1). Reviews a
 * fused app model against explicit criteria and returns a verdict + findings
 * that become a Critique row.
 */

export const critiqueFindingSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]),
  claim: z.string(),
  detail: z.string(),
  suggestedFix: z.string().optional(),
});

export const modelReviewSchema = z.object({
  verdict: z.enum(["approved", "rejected", "needs_human"]),
  findings: z.array(critiqueFindingSchema).default([]),
});

export type ModelReview = z.infer<typeof modelReviewSchema>;

export async function reviewModel(model: AppModelDoc): Promise<{
  review: ModelReview;
  costUsd: number;
}> {
  const system = await loadPrompt("critic-model");
  const result = await complete({
    tier: "sonnet",
    system,
    user: `App model to review:\n\n${JSON.stringify(model, null, 2)}`,
    maxTokens: 4096,
  });
  const review = modelReviewSchema.parse(extractJson(result.text));
  return { review, costUsd: result.costUsd };
}
