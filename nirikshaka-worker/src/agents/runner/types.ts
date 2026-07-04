import { z } from "zod";
import type { Locator, Page } from "playwright";
import type { NormalizedStep, TargetInput } from "../../schema/test-steps";
import type { TemplateScope } from "./templating";
import type { ResolvedSelector } from "./targeting";

/** execute_run task payload (doc §5.3 + §6). baseUrl/credentials are never hardcoded in YAML. */
export const runPayloadSchema = z.object({
  scope: z.enum(["project", "suite", "case", "tag"]).default("project"),
  scopeRef: z.string().optional(),
  baseUrl: z.string().min(1, "baseUrl is required (never hardcoded in test YAML)"),
  /** Merged over each case's data{} — credentials/test accounts arrive here. */
  data: z.record(z.string()).default({}),
  maxCostUsd: z.number().positive().optional(),
  trigger: z.enum(["manual", "mcp", "schedule", "ci"]).default("manual"),
  gitSha: z.string().optional(),
});
export type RunPayload = z.infer<typeof runPayloadSchema>;

export interface StepLogEntry {
  index: number;
  action: string;
  target?: string;
  status: "passed" | "failed" | "recovered" | "skipped";
  durationMs: number;
  attempts: number;
  note?: string;
}

export interface CaseOutcome {
  status: "passed" | "failed" | "error" | "skipped";
  durationMs: number;
  usedFastPath: boolean;
  llmCalls: number;
  llmCostUsd: number;
  stepLog: StepLogEntry[];
  screenshots: string[];
  errorMessage?: string;
}

/** Thrown by the step loop when a step exhausts fast path + recovery. */
export class StepFailedError extends Error {
  constructor(
    message: string,
    public readonly stepIndex: number,
    public readonly action: string
  ) {
    super(message);
    this.name = "StepFailedError";
  }
}

/** Execution context handed to the step executor by the case runner. */
export interface ExecContext {
  page: Page;
  /** Current scope root — the page, or a container locator inside `within`. */
  root: Page | Locator;
  scope: TemplateScope;
  /** Fast-path resolution (locator cache → declared target). */
  resolveTarget(target: TargetInput, stepIndex: number): Promise<Locator>;
  /** Recursive step execution with full loop semantics (within/if_visible/for_each). */
  runSteps(steps: NormalizedStep[], root: Page | Locator): Promise<void>;
}

/**
 * LLM recovery hook (doc §5.3) — provided by recovery.ts, injected so the
 * case runner stays testable without an LLM.
 */
export type RecoverFn = (input: {
  page: Page;
  step: NormalizedStep;
  stepIndex: number;
  target: TargetInput;
  failure: string;
  priorAttempts: ResolvedSelector[];
}) => Promise<{
  selector: ResolvedSelector | null;
  llmCalls: number;
  costUsd: number;
}>;
