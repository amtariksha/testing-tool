import { z } from "zod";
import { completeStructured, loadPrompt } from "../../llm/client";
import type { AppModelDoc } from "../../schema/app-model";

/**
 * Critic's model review (implementation doc §7 Phase 1, Critic v1). Reviews a
 * fused app model against explicit criteria and returns a verdict + findings
 * that become a Critique row. Structured tool-use output — findings quote
 * model text freely without JSON-escaping hazards.
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

export const REVIEW_TOOL_SCHEMA = {
  type: "object",
  required: ["verdict"],
  properties: {
    verdict: { type: "string", enum: ["approved", "rejected", "needs_human"] },
    findings: {
      type: "array",
      items: {
        type: "object",
        required: ["severity", "claim", "detail"],
        properties: {
          severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
          claim: { type: "string" },
          detail: { type: "string" },
          suggestedFix: { type: "string" },
        },
      },
    },
  },
} as const;

export async function reviewModel(model: AppModelDoc): Promise<{
  review: ModelReview;
  costUsd: number;
}> {
  const system = await loadPrompt("critic-model");
  const result = await completeStructured({
    tier: "sonnet",
    system,
    user: `App model to review:\n\n${JSON.stringify(model, null, 2)}`,
    maxTokens: 8192,
    schema: REVIEW_TOOL_SCHEMA as unknown as Record<string, unknown>,
  });
  const review = modelReviewSchema.parse(result.value);
  return { review, costUsd: result.costUsd };
}
