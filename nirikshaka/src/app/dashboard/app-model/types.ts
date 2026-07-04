/**
 * Client-side mirrors of the worker's Zod schemas
 * (nirikshaka-worker/src/schema/app-model.ts — the source of truth). Only
 * fields declared there may be written back into AppModel.model: the worker's
 * parse() strips unknown keys.
 */

export interface PilotProject {
  id: string;
  name: string;
  platform: string;
}

export interface BusinessRule {
  rule: string;
  source: string;
  confidence: number;
}

export interface FeatureReview {
  decision?: "approved" | "rejected";
  criticalPath?: boolean;
  note?: string;
  edited?: boolean;
  by?: string;
  at?: string;
}

export interface Feature {
  id: string;
  name: string;
  confidence: number;
  roles: string[];
  screens: string[];
  apis: string[];
  states: string[];
  business_rules: BusinessRule[];
  summary?: string;
  review?: FeatureReview;
}

export interface TargetedQuestion {
  id: string;
  question: string;
  featureId?: string;
  reason?: string;
  answer?: { text: string; by?: string; at?: string };
}

export interface AppModelDoc {
  features: Feature[];
  screens: { id: string }[];
  flows: unknown[];
  apiChains: unknown[];
  coverage_boundaries: { agent_can_test: string[]; needs_human: string[] };
  targeted_questions?: TargetedQuestion[];
  meta?: { sourceTaskId?: string; iteration?: number };
}

export interface EvidenceRef {
  source: string;
  ref: string;
  confidence: number;
}

export interface Discrepancy {
  claim: string;
  specSays: string;
  telemetrySays: string;
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface CritiqueFinding {
  severity: string;
  claim: string;
  detail: string;
  suggestedFix?: string;
}

export interface Critique {
  verdict: string;
  findings: CritiqueFinding[];
  iteration?: number;
}

export interface LoadedModel {
  appModel: {
    id: string;
    version: number;
    status: string;
    model: AppModelDoc;
    evidence: Record<string, EvidenceRef[]>;
    discrepancies: Discrepancy[] | null;
    confirmedBy: string | null;
    confirmedAt: string | null;
  };
  critique: Critique | null;
}

export const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-500/15 text-gray-400",
  IN_REVIEW: "bg-yellow-500/15 text-yellow-400",
  CONFIRMED: "bg-green-500/15 text-green-400",
  STALE: "bg-red-500/15 text-red-400",
};

export const SEVERITY_STYLES: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-gray-400",
};

export function confidenceColor(c: number): string {
  if (c >= 0.8) return "bg-green-500";
  if (c >= 0.6) return "bg-yellow-500";
  return "bg-red-500";
}
