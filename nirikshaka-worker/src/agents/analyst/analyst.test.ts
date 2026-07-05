import { describe, expect, it } from "vitest";
import { emptyAppModel, type AppModelDoc } from "../../schema/app-model";
import { detectFlakes, type CaseRunHistory } from "./flake";
import { findCostOutliers } from "./cost";
import { diffTelemetryVsModel } from "./staleness";

const OPTS = { windowRuns: 10, minSamples: 4, rateThreshold: 0.3 };
const hist = (externalId: string, statuses: string[], flaky: boolean[] = []): CaseRunHistory => ({
  caseId: externalId,
  externalId,
  results: statuses.map((status, i) => ({ status, flaky: flaky[i] ?? false })),
});

describe("detectFlakes", () => {
  it("flags an alternating pass/fail case as chronic", () => {
    const [v] = detectFlakes([hist("c1", ["passed", "failed", "passed", "failed"])], OPTS);
    expect(v!.flipRate).toBe(1);
    expect(v!.chronic).toBe(true);
  });

  it("does not flag a mostly-stable case below the flip threshold", () => {
    // 1 flip across 4 transitions = 0.25 < 0.3 threshold.
    const [v] = detectFlakes([hist("c2", ["passed", "passed", "passed", "passed", "failed"])], OPTS);
    expect(v!.flipRate).toBeCloseTo(0.25);
    expect(v!.chronic).toBe(false);
  });

  it("ignores cases below the minimum sample count", () => {
    expect(detectFlakes([hist("c3", ["passed", "failed", "passed"])], OPTS)).toHaveLength(0);
  });

  it("flags retry-flaky majority even without pass/fail flips", () => {
    const [v] = detectFlakes(
      [hist("c4", ["passed", "passed", "passed", "passed"], [true, true, false, false])],
      OPTS
    );
    expect(v!.retryFlakes).toBe(2);
    expect(v!.chronic).toBe(true);
  });
});

describe("findCostOutliers", () => {
  it("flags a genuine spike above the z-threshold and absolute floor", () => {
    const outliers = findCostOutliers(
      [
        { caseId: "a", externalId: "a", llmCostUsd: 0.01 },
        { caseId: "b", externalId: "b", llmCostUsd: 0.01 },
        { caseId: "c", externalId: "c", llmCostUsd: 0.02 },
        { caseId: "d", externalId: "d", llmCostUsd: 2.0 },
      ],
      { z: 1.5, minUsd: 0.25 }
    );
    expect(outliers[0]!.caseId).toBe("d");
  });

  it("suppresses micro-outliers below the absolute floor", () => {
    const outliers = findCostOutliers(
      [
        { caseId: "a", externalId: "a", llmCostUsd: 0.001 },
        { caseId: "b", externalId: "b", llmCostUsd: 0.001 },
        { caseId: "c", externalId: "c", llmCostUsd: 0.001 },
        { caseId: "d", externalId: "d", llmCostUsd: 0.02 },
      ],
      { z: 1.5, minUsd: 0.25 }
    );
    expect(outliers).toHaveLength(0);
  });

  it("returns nothing when all costs are equal (zero variance guard)", () => {
    expect(
      findCostOutliers(
        [
          { caseId: "a", externalId: "a", llmCostUsd: 0.5 },
          { caseId: "b", externalId: "b", llmCostUsd: 0.5 },
          { caseId: "c", externalId: "c", llmCostUsd: 0.5 },
        ],
        { z: 3, minUsd: 0.25 }
      )
    ).toHaveLength(0);
  });
});

describe("diffTelemetryVsModel", () => {
  const model: AppModelDoc = {
    ...emptyAppModel(),
    screens: [
      { id: "login", observedNames: ["LoginScreen"], avgDurationMs: null, topTransitions: [{ to: "dashboard", count: 100 }] },
      { id: "dashboard", observedNames: [], avgDurationMs: null, topTransitions: [] },
    ],
    features: [
      { id: "auth", name: "Auth", confidence: 0.9, roles: [], screens: ["login"], apis: ["POST /auth/login"], states: [], depends_on: [], affects: [], business_rules: [] },
    ],
  };
  const OPT = { flowShiftThreshold: 0.5, minTransitionSupport: 10, materialNewCount: 2 };

  it("detects new screens and endpoints as material when ≥2", () => {
    const diff = diffTelemetryVsModel(
      model,
      { screenNames: ["Billing", "Reports"], endpoints: ["GET /billing"], transitions: [] },
      OPT
    );
    expect(diff.newScreens).toContain("billing");
    expect(diff.newEndpoints).toContain("GET /billing");
    expect(diff.material).toBe(true);
  });

  it("does not flip on a single new screen (below material threshold)", () => {
    const diff = diffTelemetryVsModel(
      model,
      { screenNames: ["LoginScreen", "Billing"], endpoints: [], transitions: [] },
      OPT
    );
    expect(diff.material).toBe(false);
  });

  it("flags a material flow-frequency shift on a supported transition", () => {
    const diff = diffTelemetryVsModel(
      model,
      { screenNames: [], endpoints: [], transitions: [{ from: "login", to: "dashboard", count: 300 }] },
      OPT
    );
    expect(diff.flowShifts.length).toBe(1);
    expect(diff.material).toBe(true);
  });

  it("empty telemetry never marks a model stale", () => {
    const diff = diffTelemetryVsModel(model, { screenNames: [], endpoints: [], transitions: [] }, OPT);
    expect(diff.material).toBe(false);
  });
});
