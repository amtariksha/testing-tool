import { z } from "zod";

/**
 * App model document schema (implementation doc §4.2). This is the Zod-validated
 * shape stored in AppModel.model (Json). Every miner emits fragments that Fuse
 * merges into one document; the Confirmation Gate renders it for human approval.
 */

export const businessRuleSchema = z.object({
  rule: z.string(),
  source: z.string(), // e.g. "prd:7.2", "telemetry:flow:raise-request-happy"
  confidence: z.number().min(0).max(1),
});

/**
 * Human review state written by the Confirmation Gate (dashboard). The
 * dashboard mirrors these shapes loosely — appModelSchema.parse() strips
 * unknown keys, so any field the dashboard writes MUST be declared here or
 * a worker re-write of the doc would silently drop it.
 */
export const featureReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]).optional(),
  criticalPath: z.boolean().optional(),
  note: z.string().optional(),
  edited: z.boolean().optional(),
  by: z.string().optional(),
  at: z.string().optional(), // ISO timestamp
});
export type FeatureReview = z.infer<typeof featureReviewSchema>;

export const featureSchema = z.object({
  id: z.string(),
  name: z.string(),
  confidence: z.number().min(0).max(1),
  roles: z.array(z.string()).default([]),
  screens: z.array(z.string()).default([]),
  apis: z.array(z.string()).default([]),
  states: z.array(z.string()).default([]),
  depends_on: z.array(z.string()).default([]),
  affects: z.array(z.string()).default([]),
  business_rules: z.array(businessRuleSchema).default([]),
  /** Scout's 5-line explain-back summary (§4.3); absent on pre-gap-4 rows. */
  summary: z.string().optional(),
  review: featureReviewSchema.optional(),
});

export const screenTransitionSchema = z.object({
  to: z.string(),
  count: z.number().int().nonnegative(),
});

export const screenSchema = z.object({
  id: z.string(),
  observedNames: z.array(z.string()).default([]),
  avgDurationMs: z.number().nonnegative().nullable().default(null),
  topTransitions: z.array(screenTransitionSchema).default([]),
});

export const flowSchema = z.object({
  id: z.string(),
  featureId: z.string().nullable().default(null),
  steps: z.array(z.string()),
  support: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
  source: z.string(), // "telemetry" | "spec" | ...
});

export const apiChainSchema = z.object({
  chain: z.array(z.string()),
  support: z.number().int().nonnegative(),
});

export const roleSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const entitySchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  fields: z.array(z.string()).default([]),
});

export const coverageBoundariesSchema = z.object({
  agent_can_test: z.array(z.string()).default([]),
  needs_human: z.array(z.string()).default([]),
});

/**
 * Scout's targeted questions (§4.3): concrete unknowns whose answers would
 * change the model. Answers arrive from the dashboard and are fed back into
 * the next fuse as evidence.
 */
export const targetedQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  featureId: z.string().optional(),
  reason: z.string().optional(),
  answer: z
    .object({ text: z.string(), by: z.string().optional(), at: z.string().optional() })
    .optional(),
});
export type TargetedQuestion = z.infer<typeof targetedQuestionSchema>;

export const appModelSchema = z.object({
  features: z.array(featureSchema).default([]),
  screens: z.array(screenSchema).default([]),
  flows: z.array(flowSchema).default([]),
  apiChains: z.array(apiChainSchema).default([]),
  roles: z.array(roleSchema).default([]),
  entities: z.array(entitySchema).default([]),
  coverage_boundaries: coverageBoundariesSchema.default({
    agent_can_test: [],
    needs_human: [],
  }),
  targeted_questions: z.array(targetedQuestionSchema).default([]),
  /** Provenance: which fuse task produced this doc (idempotency + audit). */
  meta: z
    .object({
      sourceTaskId: z.string().optional(),
      iteration: z.number().int().optional(),
    })
    .optional(),
});

export type AppModelDoc = z.infer<typeof appModelSchema>;
export type Feature = z.infer<typeof featureSchema>;
export type Screen = z.infer<typeof screenSchema>;
export type Flow = z.infer<typeof flowSchema>;
export type ApiChain = z.infer<typeof apiChainSchema>;
export type Role = z.infer<typeof roleSchema>;
export type Entity = z.infer<typeof entitySchema>;

/**
 * Evidence index: maps a claim id to the sources that support it
 * (AppModel.evidence Json). A claim id is a stable string like
 * "feature:maintenance-request" or "flow:raise-request-happy".
 */
export const evidenceRefSchema = z.object({
  source: z.string(), // "telemetry" | "prd" | "openapi" | "figma" | "human"
  ref: z.string(), // pointer: journey id, "prd:7.2", endpoint, etc.
  confidence: z.number().min(0).max(1),
});
export const evidenceIndexSchema = z.record(z.string(), z.array(evidenceRefSchema));
export type EvidenceIndex = z.infer<typeof evidenceIndexSchema>;

export const discrepancySchema = z.object({
  claim: z.string(),
  specSays: z.string(),
  telemetrySays: z.string(),
  resolution: z.string().optional(),
  resolvedBy: z.string().optional(),
  resolvedAt: z.string().optional(), // ISO timestamp
});
export const discrepanciesSchema = z.array(discrepancySchema);
export type Discrepancy = z.infer<typeof discrepancySchema>;

export const emptyAppModel = (): AppModelDoc => appModelSchema.parse({});
