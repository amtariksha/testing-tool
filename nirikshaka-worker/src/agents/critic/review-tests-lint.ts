import type { AppModelDoc } from "../../schema/app-model";
import type { TestCaseDoc } from "../../schema/test-yaml";
import type { NormalizedStep, Target } from "../../schema/test-steps";

/**
 * Deterministic pre-LLM lint for generated tests (doc §7 Phase 3) — free,
 * pure, and merged into the Critic's findings. A critical lint finding
 * forces a rejected verdict regardless of what the LLM thought.
 */

export interface LintFinding {
  severity: "critical" | "high" | "medium" | "low";
  claim: string;
  detail: string;
  suggestedFix?: string;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
const PHONE_RE = /\+\d{10,}|\b\d{10}\b/;

function flatSteps(steps: NormalizedStep[]): NormalizedStep[] {
  const out: NormalizedStep[] = [];
  for (const step of steps) {
    out.push(step);
    const p = step.params as { steps?: NormalizedStep[]; else?: NormalizedStep[] } | null;
    if (p && typeof p === "object") {
      if (Array.isArray(p.steps)) out.push(...flatSteps(p.steps));
      if (Array.isArray(p.else)) out.push(...flatSteps(p.else));
    }
  }
  return out;
}

function stringValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(stringValues);
  }
  return [];
}

export function lintTestYaml(doc: TestCaseDoc, model: AppModelDoc): LintFinding[] {
  const findings: LintFinding[] = [];
  const steps = flatSteps(doc.steps);

  // sleep abuse (PRD §5.3: "last resort, always flagged by Critic")
  const sleeps = steps.filter((s) => s.action === "sleep");
  const longSleep = sleeps.some((s) => {
    const p = s.params as number | { ms: number };
    return (typeof p === "number" ? p : p.ms) > 3000;
  });
  if (sleeps.length > 1 || longSleep) {
    findings.push({
      severity: "high",
      claim: `case:${doc.id}`,
      detail: `${sleeps.length} sleep step(s)${longSleep ? " incl. one over 3s" : ""} — sleeps mask race conditions`,
      suggestedFix: "replace with wait_for_selector / expect_visible",
    });
  }

  // missing verify_backend on a state-changing feature
  const featureId =
    doc.tags.find((t) => t.startsWith("feature:"))?.slice("feature:".length) ??
    model.flows.find((f) => f.id === doc.source_flow)?.featureId;
  const feature = model.features.find((f) => f.id === featureId);
  if (feature && feature.states.length > 0 && !doc.verify_backend) {
    findings.push({
      severity: "critical",
      claim: `case:${doc.id}`,
      detail: `feature "${feature.id}" is state-changing (states: ${feature.states.join(", ")}) but the case has no verify_backend block — silent 500s would pass`,
      suggestedFix: "add verify_backend with no_5xx + api_succeeded for the mutation",
    });
  }

  // hardcoded data (emails/phones outside {{templates}})
  const literals = steps
    .flatMap((s) => stringValues(s.params))
    .filter((v) => !v.includes("{{"));
  const hardcoded = literals.filter((v) => EMAIL_RE.test(v) || PHONE_RE.test(v));
  if (hardcoded.length > 0) {
    findings.push({
      severity: "high",
      claim: `case:${doc.id}`,
      detail: `hardcoded credential-like values: ${hardcoded.slice(0, 3).join(", ")}`,
      suggestedFix: "move into data{} and reference via {{data.X}}",
    });
  }

  // raw css where no semantic locator was even attempted
  const cssOnly = steps.filter((s) => {
    const p = s.params as Target | { target?: Target } | string | null;
    const t =
      typeof p === "object" && p !== null
        ? "css" in p
          ? (p as Target)
          : ((p as { target?: Target }).target ?? null)
        : null;
    return (
      t !== null &&
      typeof t === "object" &&
      t.css &&
      !t.testid &&
      !t.role &&
      !t.label &&
      !t.text &&
      !t.placeholder
    );
  });
  if (cssOnly.length > 0) {
    findings.push({
      severity: "medium",
      claim: `case:${doc.id}`,
      detail: `${cssOnly.length} step(s) target raw CSS with no semantic fallback`,
      suggestedFix: "prefer testid/role/label/text targeting (grammar priority)",
    });
  }

  return findings;
}
