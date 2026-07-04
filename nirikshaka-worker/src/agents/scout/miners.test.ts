import { describe, it, expect } from "vitest";
import { buildFlowFragment, slugify } from "./flow-miner";
import { buildApiChainFragment } from "./api-chain-miner";
import type { TransitionRow, ScreenStatRow, ApiCallRow } from "./types";

describe("slugify", () => {
  it("normalizes screen names to stable slugs", () => {
    expect(slugify("New Request")).toBe("new-request");
    expect(slugify("RequestList")).toBe("requestlist");
    expect(slugify("  /bookings/detail  ")).toBe("bookings-detail");
    expect(slugify("")).toBe("screen");
  });
});

describe("buildFlowFragment", () => {
  const stats: ScreenStatRow[] = [
    { screen: "Request List", occurrences: 400, avg_duration_ms: 34000 },
    { screen: "New Request", occurrences: 120, avg_duration_ms: 22000 },
  ];

  it("builds screens with slugged ids and top transitions", () => {
    const transitions: TransitionRow[] = [
      { from_screen: "Request List", to_screen: "New Request", cnt: 300 },
      { from_screen: "New Request", to_screen: "Request List", cnt: 280 },
    ];
    const frag = buildFlowFragment(transitions, stats);
    const requestList = frag.screens!.find((s) => s.id === "request-list")!;
    expect(requestList.observedNames).toEqual(["Request List"]);
    expect(requestList.avgDurationMs).toBe(34000);
    expect(requestList.topTransitions).toEqual([{ to: "new-request", count: 300 }]);
  });

  it("drops transitions below minSupport", () => {
    const transitions: TransitionRow[] = [
      { from_screen: "Request List", to_screen: "New Request", cnt: 1 },
    ];
    const frag = buildFlowFragment(transitions, stats, { minSupport: 2 });
    expect(frag.flows).toHaveLength(0);
  });

  it("computes edge confidence as share of source outgoing traffic", () => {
    const transitions: TransitionRow[] = [
      { from_screen: "Request List", to_screen: "New Request", cnt: 300 },
      { from_screen: "Request List", to_screen: "Request Detail", cnt: 100 },
    ];
    const frag = buildFlowFragment(transitions, stats);
    const main = frag.flows!.find((f) => f.id === "request-list--new-request")!;
    expect(main.support).toBe(300);
    expect(main.confidence).toBe(0.75); // 300 / 400
    expect(main.source).toBe("telemetry");
    expect(frag.evidence["flow:request-list--new-request"]).toBeDefined();
  });

  it("returns empty fragment for no telemetry (spec-first pilot state)", () => {
    const frag = buildFlowFragment([], []);
    expect(frag.screens).toEqual([]);
    expect(frag.flows).toEqual([]);
    expect(frag.evidence).toEqual({});
  });
});

describe("buildApiChainFragment", () => {
  it("rolls repeated ordered sequences into supported chains", () => {
    const rows: ApiCallRow[] = [
      { session_key: "s1", endpoint: "POST /auth/otp", seq: 1 },
      { session_key: "s1", endpoint: "POST /auth/verify", seq: 2 },
      { session_key: "s1", endpoint: "GET /me", seq: 3 },
      { session_key: "s2", endpoint: "POST /auth/otp", seq: 1 },
      { session_key: "s2", endpoint: "POST /auth/verify", seq: 2 },
      { session_key: "s2", endpoint: "GET /me", seq: 3 },
    ];
    const frag = buildApiChainFragment(rows, { minSupport: 2 });
    expect(frag.apiChains).toHaveLength(1);
    expect(frag.apiChains![0]).toEqual({
      chain: ["POST /auth/otp", "POST /auth/verify", "GET /me"],
      support: 2,
    });
    expect(frag.evidence["apiChain:0"]).toBeDefined();
  });

  it("ignores single-call sessions and below-support chains", () => {
    const rows: ApiCallRow[] = [
      { session_key: "s1", endpoint: "GET /me", seq: 1 },
      { session_key: "s2", endpoint: "POST /a", seq: 1 },
      { session_key: "s2", endpoint: "POST /b", seq: 2 },
    ];
    const frag = buildApiChainFragment(rows, { minSupport: 2 });
    expect(frag.apiChains).toEqual([]);
  });

  it("preserves order via seq even when rows arrive shuffled", () => {
    const rows: ApiCallRow[] = [
      { session_key: "s1", endpoint: "GET /me", seq: 3 },
      { session_key: "s1", endpoint: "POST /auth/otp", seq: 1 },
      { session_key: "s1", endpoint: "POST /auth/verify", seq: 2 },
      { session_key: "s2", endpoint: "GET /me", seq: 3 },
      { session_key: "s2", endpoint: "POST /auth/otp", seq: 1 },
      { session_key: "s2", endpoint: "POST /auth/verify", seq: 2 },
    ];
    const frag = buildApiChainFragment(rows, { minSupport: 2 });
    expect(frag.apiChains![0]!.chain).toEqual([
      "POST /auth/otp",
      "POST /auth/verify",
      "GET /me",
    ]);
  });
});
