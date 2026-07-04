import { z } from "zod";
import { complete, extractJson, loadPrompt } from "../../llm/client";
import type { ModelTier } from "../../llm/router";
import { pruneDom } from "./dom-prune";
import type { ResolvedSelector } from "./targeting";
import type { RecoverFn } from "./types";

/**
 * LLM recovery (doc §5.3): Haiku first at temperature 0; escalate to Sonnet
 * when Haiku is unsure (confidence < 0.7) or a proposal already failed.
 * Sonnet (claude-sonnet-5) must NEVER receive a temperature parameter — the
 * plan below simply omits the key and llm/client.ts only sends it when set.
 * Hard cap: 3 LLM calls per step across all rounds.
 */

export const MAX_RECOVERY_CALLS = 3;
export const HAIKU_CONFIDENCE_FLOOR = 0.7;

export interface AttemptPlan {
  tier: ModelTier;
  temperature?: number;
}

/** Pure escalation policy — unit-tested. Returns null when the budget is spent. */
export function nextAttempt(callsMade: number): AttemptPlan | null {
  if (callsMade >= MAX_RECOVERY_CALLS) return null;
  if (callsMade === 0) return { tier: "haiku", temperature: 0 };
  return { tier: "sonnet" }; // deliberately NO temperature key
}

const recoveryOutputSchema = z.object({
  strategy: z.enum(["testid", "role", "label", "text", "placeholder", "css"]),
  value: z.string().min(1),
  name: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

export interface RecoveryDeps {
  /** Remaining LLM calls this step may spend (shared across rounds). */
  callsMade: number;
}

/**
 * Build the RecoverFn injected into the case runner. `chargeLlm` lets the
 * run-level cost cap veto further spending mid-recovery.
 */
export function createRecoverFn(chargeLlm: (costUsd: number) => boolean): RecoverFn {
  return async ({ page, step, target, failure, priorAttempts }) => {
    let callsMade = priorAttempts.length; // one call ≈ one prior proposal
    let llmCalls = 0;
    let costUsd = 0;

    const html = await page.content().catch(() => "");
    const dom = pruneDom(html);
    const system = await loadPrompt("runner-recovery");

    while (true) {
      const plan = nextAttempt(callsMade);
      if (!plan) return { selector: null, llmCalls, costUsd };

      const user = JSON.stringify(
        {
          action: step.action,
          declaredTarget: target,
          failure: failure.slice(0, 500),
          priorFailedAttempts: priorAttempts,
          dom,
        },
        null,
        2
      );

      let parsed: z.infer<typeof recoveryOutputSchema>;
      try {
        const result = await complete({
          tier: plan.tier,
          system,
          user,
          maxTokens: 1024,
          ...(plan.temperature !== undefined ? { temperature: plan.temperature } : {}),
        });
        llmCalls += 1;
        callsMade += 1;
        costUsd += result.costUsd;
        if (!chargeLlm(result.costUsd)) {
          return { selector: null, llmCalls, costUsd };
        }
        parsed = recoveryOutputSchema.parse(extractJson(result.text));
      } catch {
        // malformed output or API failure — try the next tier if budget allows
        callsMade += 1;
        continue;
      }

      // Haiku unsure → escalate to Sonnet without trying the proposal.
      if (plan.tier === "haiku" && parsed.confidence < HAIKU_CONFIDENCE_FLOOR) {
        priorAttempts.push({
          strategy: parsed.strategy,
          value: parsed.value,
          ...(parsed.name ? { name: parsed.name } : {}),
        });
        continue;
      }

      if (parsed.confidence === 0) {
        return { selector: null, llmCalls, costUsd };
      }

      const selector: ResolvedSelector = {
        strategy: parsed.strategy,
        value: parsed.value,
        ...(parsed.name ? { name: parsed.name } : {}),
      };
      return { selector, llmCalls, costUsd };
    }
  };
}
