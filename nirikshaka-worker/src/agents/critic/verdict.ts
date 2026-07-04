import type { ApiSucceededExpect } from "../../schema/test-yaml";
import type { ApiRow, CrashRow, UiErrorRow } from "./telemetry-queries";

/**
 * Tri-state Truth Check verdict (doc §5.4) — pure and fully unit-testable:
 *   GREEN = UI pass + backend clean
 *   AMBER = UI pass + backend anomalies   ← "silent failure caught"
 *   RED   = UI fail
 */

export type TriState = "GREEN" | "AMBER" | "RED";

export interface ExpectationResult {
  expect: ApiSucceededExpect;
  /** Latest matching request in the window, if any. */
  matched: ApiRow | null;
  ok: boolean;
}

export interface CaseVerdictInput {
  uiPassed: boolean;
  http5xx: ApiRow[];
  crashes: CrashRow[];
  uiErrors: UiErrorRow[];
  expectations: Array<{ expect: ApiSucceededExpect; matched: ApiRow | null }>;
}

export interface CaseVerdict {
  final: TriState;
  ui: "pass" | "fail";
  backend: {
    clean: boolean;
    http5xx: ApiRow[];
    crashes: number;
    uiErrors: UiErrorRow[];
    expectations: ExpectationResult[];
  };
}

export function evaluateExpectation(input: {
  expect: ApiSucceededExpect;
  matched: ApiRow | null;
}): ExpectationResult {
  const ok = input.matched !== null && input.matched.status < input.expect.status_lt;
  return { expect: input.expect, matched: input.matched, ok };
}

export function computeCaseVerdict(input: CaseVerdictInput): CaseVerdict {
  const expectations = input.expectations.map(evaluateExpectation);
  const backendClean =
    input.http5xx.length === 0 &&
    input.crashes.length === 0 &&
    input.uiErrors.length === 0 &&
    expectations.every((e) => e.ok);

  const final: TriState = !input.uiPassed ? "RED" : backendClean ? "GREEN" : "AMBER";

  return {
    final,
    ui: input.uiPassed ? "pass" : "fail",
    backend: {
      clean: backendClean,
      http5xx: input.http5xx,
      crashes: input.crashes.length,
      uiErrors: input.uiErrors,
      expectations,
    },
  };
}

const SEVERITY: Record<TriState, number> = { GREEN: 0, AMBER: 1, RED: 2 };

export function rollupRunVerdict(verdicts: TriState[]): TriState {
  if (verdicts.length === 0) return "GREEN";
  return verdicts.reduce((worst, v) => (SEVERITY[v] > SEVERITY[worst] ? v : worst), "GREEN");
}
