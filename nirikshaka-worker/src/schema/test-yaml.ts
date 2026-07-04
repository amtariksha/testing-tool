import { createHash } from "node:crypto";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import {
  normalizeSteps,
  type NormalizedStep,
  type RawStep,
} from "./test-steps";

/**
 * YAML test-case document schema (implementation doc §5.2 = PRD v3 §5 plus
 * verify_backend and source_flow). Cross-app documents (`apps:` block)
 * VALIDATE — the schema is forward-compatible — but carry crossApp=true and
 * the Phase 2 runner refuses to execute them.
 */

export const apiSucceededSchema = z.object({
  path_contains: z.string(),
  method: z.string().optional(),
  status_lt: z.number().int().positive().default(500),
});
export type ApiSucceededExpect = z.infer<typeof apiSucceededSchema>;

/**
 * verify_backend.expect entries — accepted YAML forms:
 *   - no_5xx: true            (map form)  |  - no_5xx        (string form)
 *   - api_succeeded: {...}
 * normalized to "no_5xx" | "no_new_crashes" | { api_succeeded }.
 */
const expectEntrySchema = z.union([
  z.literal("no_5xx"),
  z.literal("no_new_crashes"),
  z.object({ no_5xx: z.literal(true) }).transform(() => "no_5xx" as const),
  z.object({ no_new_crashes: z.literal(true) }).transform(() => "no_new_crashes" as const),
  z.object({ api_succeeded: apiSucceededSchema }),
]);
export type VerifyExpectation = z.infer<typeof expectEntrySchema>;

export const verifyBackendSchema = z.object({
  window_ms: z.number().int().positive().default(8000),
  expect: z.array(expectEntrySchema).default(["no_5xx", "no_new_crashes"]),
});
export type VerifyBackend = z.infer<typeof verifyBackendSchema>;

const rawStepArraySchema = z.array(z.union([z.string(), z.record(z.unknown())]));

export const testYamlSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  suite: z.string().min(1),
  platform: z.enum(["web", "android", "ios"]).default("web"),
  project: z.string().optional(),
  priority: z.string().optional(),
  tags: z.array(z.string()).default([]),
  needs_review: z.boolean().optional(),
  confidence: z.string().optional(),
  generated_from: z.array(z.string()).default([]),
  /** Cross-app block (PRD v3 §5.1) — accepted, executed from Phase 4. */
  apps: z.record(z.unknown()).optional(),
  data: z.record(z.string()).default({}),
  steps: rawStepArraySchema.min(1),
  assertions: z.array(z.record(z.unknown())).default([]),
  cleanup: rawStepArraySchema.default([]),
  verify_backend: verifyBackendSchema.optional(),
  /** Traceability to the app-model flow this case covers (doc §5.2). */
  source_flow: z.string().optional(),
});
export type TestYamlDocRaw = z.infer<typeof testYamlSchema>;

export interface TestCaseDoc extends Omit<TestYamlDocRaw, "steps" | "cleanup"> {
  steps: NormalizedStep[];
  cleanup: NormalizedStep[];
  /** True when the document uses the cross-app format. */
  crossApp: boolean;
}

/** Cross-app docs use phase entries ({app, phase?, do: [...]}) instead of primitives. */
function isCrossApp(doc: TestYamlDocRaw): boolean {
  if (doc.apps && Object.keys(doc.apps).length > 0) return true;
  return doc.steps.some(
    (s) => typeof s === "object" && s !== null && "app" in s && "do" in s
  );
}

export function parseTestYaml(yamlText: string): TestCaseDoc {
  let parsed: unknown;
  try {
    parsed = parseYaml(yamlText);
  } catch (error: unknown) {
    throw new Error(
      `invalid YAML: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const doc = testYamlSchema.parse(parsed);

  if (isCrossApp(doc)) {
    // Steps stay raw (phase entries) — the runner rejects execution for now.
    return { ...doc, steps: [], cleanup: [], crossApp: true };
  }

  return {
    ...doc,
    steps: normalizeSteps(doc.steps as RawStep[]),
    cleanup: normalizeSteps(doc.cleanup as RawStep[]),
    crossApp: false,
  };
}

export function hashYaml(yamlText: string): string {
  return createHash("sha256").update(yamlText, "utf8").digest("hex");
}
