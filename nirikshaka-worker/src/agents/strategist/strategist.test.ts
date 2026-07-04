import { describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { emptyAppModel, type AppModelDoc } from "../../schema/app-model";
import { testStrategySchema } from "../../schema/strategy";
import { assertConfirmedModel, ConfirmationGateError } from "../guards";
import { applyBoundaries } from "./boundaries";

function stubPrisma(latest: { id: string; version: number; status: string } | null) {
  return {
    appModel: { findFirst: async () => latest },
  } as unknown as PrismaClient;
}

describe("assertConfirmedModel (the gate is law)", () => {
  it("throws when no model exists", async () => {
    await expect(assertConfirmedModel(stubPrisma(null), "p1")).rejects.toThrow(
      ConfirmationGateError
    );
  });

  it("throws when the LATEST version is not CONFIRMED (older CONFIRMED doesn't count)", async () => {
    // findFirst orders by version desc — a newer DRAFT wins the lookup.
    await expect(
      assertConfirmedModel(stubPrisma({ id: "m4", version: 4, status: "DRAFT" }), "p1")
    ).rejects.toThrow(/v4.*DRAFT.*Confirmation Gate/s);
    await expect(
      assertConfirmedModel(stubPrisma({ id: "m4", version: 4, status: "STALE" }), "p1")
    ).rejects.toThrow(ConfirmationGateError);
  });

  it("returns the model when latest is CONFIRMED", async () => {
    const model = { id: "m5", version: 5, status: "CONFIRMED" };
    await expect(assertConfirmedModel(stubPrisma(model), "p1")).resolves.toEqual(model);
  });
});

describe("strategy schema", () => {
  it("round-trips a full strategy with defaults", () => {
    const parsed = testStrategySchema.parse({
      suites: [{ id: "auth", name: "Auth" }],
      coverage: [{ featureId: "auth", priority: "P0", caseBudget: 3 }],
      totalCaseBudget: 3,
    });
    expect(parsed.coverage[0]!.skipAgent).toBe(false);
    expect(parsed.coverage[0]!.flowIds).toEqual([]);
    expect(parsed.skip_agent).toEqual([]);
  });

  it("rejects unknown priorities", () => {
    expect(() =>
      testStrategySchema.parse({
        coverage: [{ featureId: "x", priority: "P9", caseBudget: 1 }],
      })
    ).toThrow();
  });
});

describe("applyBoundaries (never trust the LLM with safety)", () => {
  const model: AppModelDoc = {
    ...emptyAppModel(),
    coverage_boundaries: { agent_can_test: ["auth"], needs_human: ["payments"] },
  };

  it("forces needs_human features to skipAgent even when the LLM says otherwise", () => {
    const strategy = testStrategySchema.parse({
      coverage: [
        { featureId: "auth", priority: "P0", caseBudget: 3 },
        { featureId: "payments", priority: "P0", caseBudget: 5, skipAgent: false },
      ],
      skip_agent: [],
      totalCaseBudget: 8,
    });
    const bounded = applyBoundaries(strategy, model);
    const payments = bounded.coverage.find((c) => c.featureId === "payments")!;
    expect(payments.skipAgent).toBe(true);
    expect(payments.reason).toContain("needs_human");
    expect(bounded.skip_agent).toContain("payments");
    // untouched entries stay untouched
    expect(bounded.coverage.find((c) => c.featureId === "auth")!.skipAgent).toBe(false);
  });

  it("is a no-op when there are no boundaries", () => {
    const strategy = testStrategySchema.parse({
      coverage: [{ featureId: "auth", priority: "P1", caseBudget: 1 }],
      totalCaseBudget: 1,
    });
    expect(applyBoundaries(strategy, emptyAppModel())).toEqual(strategy);
  });
});
