import { describe, expect, it } from "vitest";
import { computeCaseVerdict, rollupRunVerdict, type CaseVerdictInput } from "./verdict";
import type { ApiRow } from "./telemetry-queries";

const row = (status: number): ApiRow => ({
  id: "r1",
  method: "POST",
  path: "/api/requests",
  status,
  timestamp: new Date("2026-07-04T10:00:00Z"),
});

const clean: CaseVerdictInput = {
  uiPassed: true,
  http5xx: [],
  crashes: [],
  uiErrors: [],
  expectations: [],
};

describe("computeCaseVerdict (tri-state matrix)", () => {
  it("GREEN: UI pass + backend clean", () => {
    expect(computeCaseVerdict(clean).final).toBe("GREEN");
  });

  it("AMBER: UI pass + a 5xx in the window — the silent failure", () => {
    const v = computeCaseVerdict({ ...clean, http5xx: [row(500)] });
    expect(v.final).toBe("AMBER");
    expect(v.backend.http5xx[0]!.status).toBe(500);
  });

  it("AMBER: UI pass + crash or ui error", () => {
    expect(
      computeCaseVerdict({
        ...clean,
        crashes: [{ id: "c", severity: "high", sessionId: "s", timestamp: new Date() }],
      }).final
    ).toBe("AMBER");
    expect(
      computeCaseVerdict({
        ...clean,
        uiErrors: [
          { id: "u", type: "runtime", component: "X", message: "boom", timestamp: new Date() },
        ],
      }).final
    ).toBe("AMBER");
  });

  it("AMBER: expected api call missing entirely", () => {
    const v = computeCaseVerdict({
      ...clean,
      expectations: [
        { expect: { path_contains: "/api/requests", method: "POST", status_lt: 400 }, matched: null },
      ],
    });
    expect(v.final).toBe("AMBER");
    expect(v.backend.expectations[0]!.ok).toBe(false);
  });

  it("AMBER: expected api call matched but status at/over the cap", () => {
    const v = computeCaseVerdict({
      ...clean,
      expectations: [
        { expect: { path_contains: "/api/requests", status_lt: 400 }, matched: row(422) },
      ],
    });
    expect(v.final).toBe("AMBER");
  });

  it("GREEN: expected api call matched under the cap", () => {
    const v = computeCaseVerdict({
      ...clean,
      expectations: [
        { expect: { path_contains: "/api/requests", status_lt: 400 }, matched: row(201) },
      ],
    });
    expect(v.final).toBe("GREEN");
  });

  it("RED: UI fail wins even with a clean backend", () => {
    expect(computeCaseVerdict({ ...clean, uiPassed: false }).final).toBe("RED");
  });

  it("RED: UI fail + backend anomalies stays RED (not AMBER)", () => {
    expect(
      computeCaseVerdict({ ...clean, uiPassed: false, http5xx: [row(503)] }).final
    ).toBe("RED");
  });
});

describe("rollupRunVerdict", () => {
  it("is worst-of", () => {
    expect(rollupRunVerdict(["GREEN", "GREEN"])).toBe("GREEN");
    expect(rollupRunVerdict(["GREEN", "AMBER"])).toBe("AMBER");
    expect(rollupRunVerdict(["AMBER", "RED", "GREEN"])).toBe("RED");
    expect(rollupRunVerdict([])).toBe("GREEN");
  });
});
