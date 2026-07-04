import { describe, expect, it } from "vitest";
import { appModelSchema, discrepancySchema } from "./app-model";

/**
 * AppModel rows written before the Confirmation Gate v2 fields existed must
 * keep parsing, and docs carrying the new fields must round-trip unchanged —
 * parse() strips unknown keys, so any drift here silently destroys review
 * state on the next worker write.
 */

const legacyDoc = {
  features: [
    {
      id: "auth",
      name: "Authentication",
      confidence: 0.9,
      roles: ["admin"],
      screens: ["login"],
      apis: ["POST /auth/login"],
      states: [],
      depends_on: [],
      affects: [],
      business_rules: [{ rule: "OTP expires in 5m", source: "prd:2.1", confidence: 0.8 }],
    },
  ],
  screens: [{ id: "login", observedNames: ["LoginScreen"], avgDurationMs: null, topTransitions: [] }],
  flows: [],
  apiChains: [],
  roles: [],
  entities: [],
  coverage_boundaries: { agent_can_test: ["auth"], needs_human: [] },
};

describe("app-model schema compatibility", () => {
  it("parses a pre-gap-4 (legacy) document", () => {
    const parsed = appModelSchema.parse(legacyDoc);
    expect(parsed.features[0]!.summary).toBeUndefined();
    expect(parsed.features[0]!.review).toBeUndefined();
    expect(parsed.targeted_questions).toEqual([]);
    expect(parsed.meta).toBeUndefined();
  });

  it("round-trips review state, summaries, questions and meta unchanged", () => {
    const doc = {
      ...legacyDoc,
      features: [
        {
          ...legacyDoc.features[0]!,
          summary: "Admins log in with phone + OTP.\nOTP expires after 5 minutes.",
          review: {
            decision: "approved" as const,
            criticalPath: true,
            note: "core flow",
            by: "pradeep@example.com",
            at: "2026-07-04T10:00:00.000Z",
          },
        },
      ],
      targeted_questions: [
        {
          id: "q-1",
          question: "Can vendors also log in?",
          featureId: "auth",
          reason: "no vendor role observed in telemetry",
          answer: { text: "No, vendors use a separate app", by: "pradeep@example.com" },
        },
      ],
      meta: { sourceTaskId: "task_123", iteration: 2 },
    };
    const parsed = appModelSchema.parse(doc);
    expect(parsed).toEqual(doc);
  });

  it("parses discrepancies with and without resolution audit fields", () => {
    expect(
      discrepancySchema.parse({ claim: "x", specSays: "a", telemetrySays: "b" }).resolution
    ).toBeUndefined();
    const resolved = discrepancySchema.parse({
      claim: "x",
      specSays: "a",
      telemetrySays: "b",
      resolution: "spec is right",
      resolvedBy: "pradeep@example.com",
      resolvedAt: "2026-07-04T10:00:00.000Z",
    });
    expect(resolved.resolvedBy).toBe("pradeep@example.com");
  });
});
