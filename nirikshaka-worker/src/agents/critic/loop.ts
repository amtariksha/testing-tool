/**
 * Generator-verifier loop decisions (implementation doc §3: "Max 3 iterations
 * then needs_human"). Pure so the full matrix is unit-testable; the handlers
 * own the side effects (Critique rows, status flips, task enqueues).
 */

export const MAX_MODEL_ITERATIONS = 3;

export type ModelVerdict = "approved" | "rejected" | "needs_human";

export interface ModelLoopDecision {
  /** Where the AppModel goes: DRAFT only while Scout is re-mining. */
  nextStatus: "DRAFT" | "IN_REVIEW";
  /** Enqueue another fuse_model with the Critic's findings as guidance. */
  reenqueueFuse: boolean;
  /** Loop exhausted — a human must look at the last rejected version. */
  escalated: boolean;
}

export function decideNextStep(verdict: ModelVerdict, iteration: number): ModelLoopDecision {
  if (verdict === "rejected") {
    if (iteration < MAX_MODEL_ITERATIONS) {
      return { nextStatus: "DRAFT", reenqueueFuse: true, escalated: false };
    }
    // No dead-end DRAFT: surface the exhausted loop to the human instead.
    return { nextStatus: "IN_REVIEW", reenqueueFuse: false, escalated: true };
  }
  return { nextStatus: "IN_REVIEW", reenqueueFuse: false, escalated: false };
}

/**
 * The test-case flavor of the same loop (Phase 3): rejected below the cap →
 * Author regenerates with the findings; at the cap (or an explicit
 * needs_human verdict) → the case is flagged for a human.
 */
export type TestLoopAction = "accept" | "regenerate" | "needs_human";

export function decideNextAction(
  verdict: ModelVerdict,
  iteration: number,
  maxIterations: number
): TestLoopAction {
  if (verdict === "approved") return "accept";
  if (verdict === "needs_human") return "needs_human";
  return iteration < maxIterations ? "regenerate" : "needs_human";
}
