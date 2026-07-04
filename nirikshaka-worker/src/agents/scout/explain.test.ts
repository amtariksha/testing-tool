import { describe, expect, it } from "vitest";
import { applyExplainBack } from "./explain";
import { buildAnswerDigest, buildGuidanceDigest } from "./digest";
import { fuseModelPayloadSchema } from "./index";
import { emptyAppModel, type AppModelDoc } from "../../schema/app-model";

function modelWithFeatures(ids: string[]): AppModelDoc {
  return {
    ...emptyAppModel(),
    features: ids.map((id) => ({
      id,
      name: id,
      confidence: 0.8,
      roles: [],
      screens: [],
      apis: [],
      states: [],
      depends_on: [],
      affects: [],
      business_rules: [],
    })),
  };
}

describe("applyExplainBack", () => {
  it("lands summaries on matching features and drops unknown featureIds", () => {
    const model = modelWithFeatures(["auth", "billing"]);
    const result = applyExplainBack(model, {
      summaries: [
        { featureId: "auth", summary: "Users log in with OTP." },
        { featureId: "ghost", summary: "should be dropped" },
      ],
      questions: [],
    });
    expect(result.features.find((f) => f.id === "auth")?.summary).toBe("Users log in with OTP.");
    expect(result.features.find((f) => f.id === "billing")?.summary).toBeUndefined();
  });

  it("assigns stable sequential question ids and validates featureId", () => {
    const model = modelWithFeatures(["auth"]);
    const result = applyExplainBack(model, {
      summaries: [],
      questions: [
        { question: "Do vendors log in?", featureId: "auth", reason: "no vendor telemetry" },
        { question: "Is there an admin panel?", featureId: "ghost" },
      ],
    });
    expect(result.targeted_questions).toEqual([
      { id: "q-1", question: "Do vendors log in?", featureId: "auth", reason: "no vendor telemetry" },
      { id: "q-2", question: "Is there an admin panel?" },
    ]);
  });

  it("is a no-op on empty output (model unchanged apart from questions reset)", () => {
    const model = modelWithFeatures(["auth"]);
    const result = applyExplainBack(model, { summaries: [], questions: [] });
    expect(result.features).toEqual(model.features);
    expect(result.targeted_questions).toEqual([]);
  });
});

describe("digest builders", () => {
  it("buildAnswerDigest formats Q/A pairs and is empty for no answers", () => {
    expect(buildAnswerDigest([])).toBe("");
    const digest = buildAnswerDigest([
      { questionId: "q-1", question: "Do vendors log in?", answer: "No, separate app" },
    ]);
    expect(digest).toContain("## Human answers");
    expect(digest).toContain("Q: Do vendors log in?");
    expect(digest).toContain("A: No, separate app");
  });

  it("buildGuidanceDigest lists findings with severity and fix", () => {
    expect(buildGuidanceDigest([])).toBe("");
    const digest = buildGuidanceDigest([
      { severity: "critical", claim: "feature:auth", detail: "invented", suggestedFix: "remove" },
    ]);
    expect(digest).toContain("## Reviewer findings");
    expect(digest).toContain("[critical] feature:auth: invented (fix: remove)");
  });
});

describe("fuseModelPayloadSchema", () => {
  it("parses a legacy payload with defaults", () => {
    const parsed = fuseModelPayloadSchema.parse({
      sources: [{ type: "prd", content: "some prd" }],
    });
    expect(parsed.iteration).toBe(1);
    expect(parsed.answers).toEqual([]);
    expect(parsed.guidance).toEqual([]);
  });

  it("accepts iteration, guidance and answers", () => {
    const parsed = fuseModelPayloadSchema.parse({
      sources: [],
      iteration: 2,
      guidance: [{ severity: "high", claim: "feature:x", detail: "thin evidence" }],
      answers: [{ questionId: "q-1", question: "?", answer: "yes", featureId: "x" }],
    });
    expect(parsed.iteration).toBe(2);
    expect(parsed.guidance).toHaveLength(1);
    expect(parsed.answers[0]!.featureId).toBe("x");
  });
});
