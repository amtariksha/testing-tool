import { z } from "zod";
import { complete, extractJson, loadPrompt } from "../../llm/client";
import type { AppModelDoc, Discrepancy } from "../../schema/app-model";

/**
 * Explain-back step (implementation doc §4.3): after fuse, Scout writes a
 * 5-line natural-language summary per feature ("if the summary is wrong, the
 * model is wrong") plus targeted questions whose answers would change the
 * model. One LLM call for the whole model; failure is non-fatal upstream.
 */

export const explainOutputSchema = z.object({
  summaries: z
    .array(z.object({ featureId: z.string(), summary: z.string() }))
    .default([]),
  questions: z
    .array(
      z.object({
        question: z.string(),
        featureId: z.string().optional(),
        reason: z.string().optional(),
      })
    )
    .default([]),
});
export type ExplainOutput = z.infer<typeof explainOutputSchema>;

export async function generateExplainBack(
  model: AppModelDoc,
  discrepancies: Discrepancy[]
): Promise<{ output: ExplainOutput; costUsd: number }> {
  const system = await loadPrompt("scout-explain");
  const projection = {
    features: model.features,
    coverage_boundaries: model.coverage_boundaries,
    discrepancies,
  };
  const result = await complete({
    tier: "sonnet",
    system,
    user: JSON.stringify(projection, null, 2),
    maxTokens: 8192,
  });
  const output = explainOutputSchema.parse(extractJson(result.text));
  return { output, costUsd: result.costUsd };
}

/**
 * Pure merge of the explain output into the model doc. Summaries for unknown
 * feature ids are dropped; questions get stable sequential ids and keep their
 * featureId only when it matches a real feature.
 */
export function applyExplainBack(model: AppModelDoc, output: ExplainOutput): AppModelDoc {
  const featureIds = new Set(model.features.map((f) => f.id));
  const summaryByFeature = new Map(
    output.summaries.filter((s) => featureIds.has(s.featureId)).map((s) => [s.featureId, s.summary])
  );

  return {
    ...model,
    features: model.features.map((feature) => {
      const summary = summaryByFeature.get(feature.id);
      return summary ? { ...feature, summary } : feature;
    }),
    targeted_questions: output.questions.map((q, index) => ({
      id: `q-${index + 1}`,
      question: q.question,
      ...(q.featureId && featureIds.has(q.featureId) ? { featureId: q.featureId } : {}),
      ...(q.reason ? { reason: q.reason } : {}),
    })),
  };
}
