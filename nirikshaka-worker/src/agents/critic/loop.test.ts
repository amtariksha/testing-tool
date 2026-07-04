import { describe, expect, it } from "vitest";
import { decideNextStep, MAX_MODEL_ITERATIONS } from "./loop";

describe("decideNextStep (model generator-verifier loop)", () => {
  it("rejected below the cap → re-mine", () => {
    for (const iteration of [1, MAX_MODEL_ITERATIONS - 1]) {
      expect(decideNextStep("rejected", iteration)).toEqual({
        nextStatus: "DRAFT",
        reenqueueFuse: true,
        escalated: false,
      });
    }
  });

  it("rejected at the cap → escalate to human, no dead-end DRAFT", () => {
    expect(decideNextStep("rejected", MAX_MODEL_ITERATIONS)).toEqual({
      nextStatus: "IN_REVIEW",
      reenqueueFuse: false,
      escalated: true,
    });
    expect(decideNextStep("rejected", MAX_MODEL_ITERATIONS + 1).escalated).toBe(true);
  });

  it("approved → human review, never escalated", () => {
    expect(decideNextStep("approved", 1)).toEqual({
      nextStatus: "IN_REVIEW",
      reenqueueFuse: false,
      escalated: false,
    });
  });

  it("needs_human at any iteration → human review, not escalated", () => {
    expect(decideNextStep("needs_human", MAX_MODEL_ITERATIONS)).toEqual({
      nextStatus: "IN_REVIEW",
      reenqueueFuse: false,
      escalated: false,
    });
  });
});
