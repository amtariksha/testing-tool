import { z } from "zod";
import { completeStructured, loadPrompt } from "../../llm/client";
import type { AppModelDoc } from "../../schema/app-model";
import type { TestStrategyDoc } from "../../schema/strategy";

/**
 * LLM batch review of generated test cases (doc §7 Phase 3). Sonnet, no
 * temperature. Findings are merged with the deterministic lint by the
 * handler; lint criticals can force a rejected verdict.
 */

export const testFindingSchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low"]),
  claim: z.string(),
  detail: z.string(),
  suggestedFix: z.string().optional(),
});

export const testReviewSchema = z.object({
  cases: z
    .array(
      z.object({
        externalId: z.string(),
        verdict: z.enum(["approved", "rejected", "needs_human"]),
        findings: z.array(testFindingSchema).default([]),
      })
    )
    .default([]),
});
export type TestReview = z.infer<typeof testReviewSchema>;

export async function reviewTests(input: {
  cases: Array<{ externalId: string; yaml: string }>;
  model: AppModelDoc;
  strategy: TestStrategyDoc | null;
}): Promise<{ review: TestReview; costUsd: number }> {
  const system = await loadPrompt("critic-tests");
  const user = JSON.stringify(
    {
      cases: input.cases,
      features: input.model.features.map((f) => ({
        id: f.id,
        name: f.name,
        screens: f.screens,
        apis: f.apis,
        states: f.states,
      })),
      strategy: input.strategy?.coverage ?? [],
    },
    null,
    2
  );
  const result = await completeStructured({
    tier: "sonnet",
    system,
    user,
    maxTokens: 8192,
    schema: {
      type: "object",
      required: ["cases"],
      properties: {
        cases: {
          type: "array",
          items: {
            type: "object",
            required: ["externalId", "verdict"],
            properties: {
              externalId: { type: "string" },
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
          },
        },
      },
    },
  });
  const review = testReviewSchema.parse(result.value);
  return { review, costUsd: result.costUsd };
}
