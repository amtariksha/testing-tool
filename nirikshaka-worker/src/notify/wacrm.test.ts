import { describe, expect, it } from "vitest";
import { buildRunNotification, shouldNotify } from "./wacrm";

const base = {
  runId: "run_1",
  projectId: "p_1",
  projectName: "CommunityOS Admin",
  verdict: "RED",
  totals: { total: 5, passed: 3, failed: 2, skipped: 0, amber: 0 },
  costUsd: 0.4123,
  scope: "suite",
  scopeRef: "smoke",
  topFindings: ["smoke-login — expect_visible 'Dashboard' timed out"],
  dashboardUrl: "https://testing-tool-weld.vercel.app/",
};

describe("shouldNotify", () => {
  it("fires on failures or AMBER, stays quiet on clean runs", () => {
    expect(shouldNotify({ failed: 1, amber: 0 })).toBe(true);
    expect(shouldNotify({ failed: 0, amber: 2 })).toBe(true);
    expect(shouldNotify({ failed: 0, amber: 0 })).toBe(false);
  });
});

describe("buildRunNotification", () => {
  it("builds a WhatsApp-ready message with verdict, counts, findings and link", () => {
    const payload = buildRunNotification(base);
    expect(payload.source).toBe("nirikshaka");
    expect(payload.message).toContain("Nirikshaka RED: 2/5 failed");
    expect(payload.message).toContain("CommunityOS Admin (suite: smoke)");
    expect(payload.message).toContain("smoke-login");
    expect(payload.message).toContain("$0.41");
    expect(payload.link).toBe(
      "https://testing-tool-weld.vercel.app/dashboard/test-runs/run_1"
    );
    expect(payload.message).toContain(payload.link!);
  });

  it("degrades without a dashboard url and caps findings at two", () => {
    const payload = buildRunNotification({
      ...base,
      dashboardUrl: undefined,
      topFindings: ["a", "b", "c"],
    });
    expect(payload.link).toBeNull();
    expect(payload.message).toContain("Top: a · b.");
    expect(payload.message).not.toContain("Details:");
  });
});
