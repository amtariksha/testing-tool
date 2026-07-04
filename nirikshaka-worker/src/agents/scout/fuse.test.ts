import { describe, it, expect } from "vitest";
import { fuse } from "./fuse";
import { parseOpenApi } from "./spec-miner";
import type { ModelFragment } from "./types";

describe("fuse", () => {
  it("merges spec features with telemetry screens and unions evidence", () => {
    const spec: ModelFragment = {
      features: [
        {
          id: "maintenance-request",
          name: "Maintenance Requests",
          confidence: 0.86,
          roles: ["resident"],
          screens: ["new-request", "request-list"],
          apis: [],
          states: [],
          depends_on: [],
          affects: [],
          business_rules: [],
        },
      ],
      evidence: { "feature:maintenance-request": [{ source: "prd", ref: "§7.2", confidence: 0.9 }] },
    };
    const telemetry: ModelFragment = {
      screens: [
        { id: "new-request", observedNames: ["NewRequest"], avgDurationMs: 34000, topTransitions: [] },
        { id: "request-list", observedNames: ["RequestList"], avgDurationMs: 12000, topTransitions: [] },
      ],
      evidence: { "screen:new-request": [{ source: "telemetry", ref: "screen_view", confidence: 1 }] },
    };

    const result = fuse([spec, telemetry]);
    expect(result.model.features).toHaveLength(1);
    expect(result.model.screens).toHaveLength(2);
    expect(result.model.coverage_boundaries.agent_can_test).toContain("maintenance-request");
    expect(result.evidence["feature:maintenance-request"]).toBeDefined();
    expect(result.discrepancies).toHaveLength(0); // both screens observed
  });

  it("flags spec screens telemetry never observed as discrepancies", () => {
    const spec: ModelFragment = {
      features: [
        {
          id: "vendor-jobs",
          name: "Vendor Jobs",
          confidence: 0.8,
          roles: [],
          screens: ["job-board", "ghost-screen"],
          apis: [],
          states: [],
          depends_on: [],
          affects: [],
          business_rules: [],
        },
      ],
      evidence: {},
    };
    const telemetry: ModelFragment = {
      screens: [{ id: "job-board", observedNames: ["JobBoard"], avgDurationMs: null, topTransitions: [] }],
      evidence: {},
    };
    const result = fuse([spec, telemetry]);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies[0]!.claim).toBe("feature:vendor-jobs");
    expect(result.discrepancies[0]!.telemetrySays).toContain("ghost-screen");
  });

  it("routes low-confidence features to needs_human", () => {
    const spec: ModelFragment = {
      features: [
        { id: "guessed", name: "Guessed", confidence: 0.4, roles: [], screens: [], apis: [], states: [], depends_on: [], affects: [], business_rules: [] },
        { id: "solid", name: "Solid", confidence: 0.9, roles: [], screens: [], apis: [], states: [], depends_on: [], affects: [], business_rules: [] },
      ],
      evidence: {},
    };
    const result = fuse([spec]);
    expect(result.model.coverage_boundaries.needs_human).toEqual(["guessed"]);
    expect(result.model.coverage_boundaries.agent_can_test).toEqual(["solid"]);
    expect(result.discrepancies).toHaveLength(0); // no telemetry → no discrepancy noise
  });
});

describe("parseOpenApi", () => {
  it("extracts entities and endpoints from an OpenAPI JSON doc", () => {
    const openapi = JSON.stringify({
      paths: {
        "/api/requests": { post: {}, get: {} },
        "/api/requests/{id}/assign": { patch: {} },
      },
      components: {
        schemas: {
          Request: { properties: { id: {}, status: {}, unit: {} } },
        },
      },
    });
    const result = parseOpenApi(openapi);
    expect(result.entities).toEqual([{ id: "request", name: "Request", fields: ["id", "status", "unit"] }]);
    expect(result.endpoints).toContain("POST /api/requests");
    expect(result.endpoints).toContain("PATCH /api/requests/{id}/assign");
    expect(result.evidence["api:POST /api/requests"]).toBeDefined();
  });

  it("throws a clear error on non-JSON (YAML) input", () => {
    expect(() => parseOpenApi("openapi: 3.0.0\npaths: {}")).toThrow(/not valid JSON/);
  });
});
