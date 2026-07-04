import type { ModelTier } from "../../llm/router";

/**
 * Pure model routing for test generation (PRD §7.2: sonnet complex / haiku
 * simple). Regeneration always uses sonnet — Critic findings mean the cheap
 * attempt already failed.
 */
export function pickTier(input: {
  mode: "strategy" | "regenerate" | "convert";
  stepCount?: number;
  roleCount?: number;
  stateChanging?: boolean;
  attempt?: number;
}): Extract<ModelTier, "haiku" | "sonnet"> {
  const attempt = input.attempt ?? 1;
  if (input.mode === "regenerate") return "sonnet";
  if (input.mode === "convert") return attempt >= 2 ? "sonnet" : "haiku";
  const simple =
    (input.stepCount ?? Number.POSITIVE_INFINITY) <= 5 &&
    (input.roleCount ?? 0) <= 1 &&
    !input.stateChanging;
  if (!simple) return "sonnet";
  return attempt >= 2 ? "sonnet" : "haiku";
}
