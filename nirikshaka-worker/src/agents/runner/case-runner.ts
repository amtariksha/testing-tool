import type { Locator, Page } from "playwright";
import type { PrismaClient } from "@prisma/client";
import type { WorkerConfig } from "../../config";
import type { NormalizedStep, TargetInput } from "../../schema/test-steps";
import type { TestCaseDoc } from "../../schema/test-yaml";
import { saveScreenshot } from "./artifacts";
import type { BrowserSession } from "./browser";
import { executeStep, getStepTarget, describeTarget } from "./executor";
import { lookupCached, recordHit, upsertLocator } from "./locator-cache";
import { buildLocator, locatorFor, semanticKey, type ResolvedSelector } from "./targeting";
import { substitute, type TemplateScope } from "./templating";
import {
  StepFailedError,
  type CaseOutcome,
  type ExecContext,
  type RecoverFn,
  type StepLogEntry,
} from "./types";

export interface CaseRunDeps {
  prisma: PrismaClient;
  config: WorkerConfig;
  session: BrowserSession;
  projectId: string;
  runId: string;
  /** LLM recovery (doc §5.3); absent → failures are final. */
  recover?: RecoverFn;
  /** Pre-LLM budget check — false stops recovery, not the fast path. */
  canSpendLlm?: () => boolean;
}

/**
 * Runs one test case: fresh context → main steps → assertions → cleanup
 * (ALWAYS, best-effort) → close. Implements the per-step loop of doc §5.3:
 * RESOLVE (cache → declared) → EXECUTE fast path → on failure LLM RECOVERY →
 * cache write-through.
 */
export async function runCase(
  deps: CaseRunDeps,
  doc: TestCaseDoc,
  input: { baseUrl: string; data: Record<string, string> }
): Promise<CaseOutcome> {
  const startedAt = Date.now();
  const stepLog: StepLogEntry[] = [];
  const screenshots: string[] = [];
  const consoleErrors: string[] = [];
  let usedFastPath = true;
  let llmCalls = 0;
  let llmCostUsd = 0;

  if (doc.crossApp) {
    return {
      status: "error",
      durationMs: 0,
      usedFastPath: true,
      llmCalls: 0,
      llmCostUsd: 0,
      stepLog,
      screenshots,
      errorMessage: "cross-app execution lands in Phase 4 — single-app tests only for now",
    };
  }

  const scope: TemplateScope = {
    data: { ...doc.data, ...input.data },
    project: { base_url: input.baseUrl },
    extracted: {},
  };

  const { context, page } = await deps.session.newRunContext(deps.runId);
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
  });

  const platform = doc.platform;

  const resolveTarget = async (target: TargetInput, stepIndex: number): Promise<Locator> => {
    const key = semanticKey(doc.id, stepIndex, target);
    const cached = await lookupCached(deps.prisma, deps.projectId, key, platform);
    if (cached) {
      await recordHit(deps.prisma, deps.projectId, key, platform).catch(() => {});
      return locatorFor(page, cached);
    }
    return buildLocator(currentRoot as never, target);
  };

  let currentRoot: Page | Locator = page;

  const runSteps = async (steps: NormalizedStep[], root: Page | Locator): Promise<void> => {
    const prevRoot = currentRoot;
    currentRoot = root;
    try {
      for (let i = 0; i < steps.length; i++) {
        await runOneStep(steps[i]!, i);
      }
    } finally {
      currentRoot = prevRoot;
    }
  };

  const ctx: ExecContext = {
    page,
    get root() {
      return currentRoot;
    },
    scope,
    resolveTarget,
    runSteps,
  };

  const runOneStep = async (step: NormalizedStep, index: number): Promise<void> => {
    const substituted: NormalizedStep = {
      action: step.action,
      params: substitute(step.params, scope),
    };
    const target = getStepTarget(substituted);
    const begun = Date.now();
    let attempts = 1;

    try {
      await executeStep(ctx, substituted, index);
      stepLog.push({
        index,
        action: step.action,
        target: describeTarget(target),
        status: "passed",
        durationMs: Date.now() - begun,
        attempts,
      });
      return;
    } catch (error: unknown) {
      const failure = error instanceof Error ? error.message : String(error);

      // LLM recovery (doc §5.3) — locator-bearing steps only, within budget.
      // Bounded rounds: a failed proposal is fed back via priorAttempts; the
      // recovery module's own 3-call cap bounds total spend per step.
      if (deps.recover && target && (deps.canSpendLlm?.() ?? true)) {
        const priorAttempts: ResolvedSelector[] = [];
        let lastFailure = failure;
        while ((deps.canSpendLlm?.() ?? true) && priorAttempts.length < 3) {
          const result = await deps.recover({
            page,
            step: substituted,
            stepIndex: index,
            target,
            failure: lastFailure,
            priorAttempts,
          });
          llmCalls += result.llmCalls;
          llmCostUsd += result.costUsd;
          attempts += Math.max(result.llmCalls, 1);
          if (!result.selector) break;

          try {
            await executeStep(ctx, substituted, index, locatorFor(page, result.selector));
            usedFastPath = false;
            const key = semanticKey(doc.id, index, target);
            await upsertLocator(
              deps.prisma,
              deps.projectId,
              key,
              platform,
              result.selector,
              0.9
            ).catch(() => {});
            stepLog.push({
              index,
              action: step.action,
              target: describeTarget(target),
              status: "recovered",
              durationMs: Date.now() - begun,
              attempts,
              note: `recovered via ${result.selector.strategy}=${result.selector.value}`,
            });
            return;
          } catch (retryError: unknown) {
            lastFailure =
              retryError instanceof Error ? retryError.message : String(retryError);
            priorAttempts.push(result.selector);
          }
        }
      }

      stepLog.push({
        index,
        action: step.action,
        target: describeTarget(target),
        status: "failed",
        durationMs: Date.now() - begun,
        attempts,
        note: failure.slice(0, 300),
      });
      throw new StepFailedError(failure, index, step.action);
    }
  };

  let status: CaseOutcome["status"] = "passed";
  let errorMessage: string | undefined;

  try {
    await runSteps(doc.steps, page);

    // assertions: block entries that are step-shaped run as steps; backend
    // entries (api_call_succeeded) are checked by the Critic's truth check.
    if (
      doc.assertions.some((a) => "no_console_errors" in a) &&
      consoleErrors.length > 0
    ) {
      throw new StepFailedError(
        `console errors: ${consoleErrors.slice(0, 3).join(" | ")}`,
        doc.steps.length,
        "no_console_errors"
      );
    }
  } catch (error: unknown) {
    status = "failed";
    errorMessage =
      error instanceof StepFailedError
        ? `step ${error.stepIndex + 1} (${error.action}): ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    const shot = await page.screenshot({ fullPage: false }).catch(() => null);
    if (shot) {
      const url = await saveScreenshot(
        deps.config,
        shot,
        deps.runId,
        doc.id,
        stepLog.length
      );
      if (url) screenshots.push(url);
    }
  }

  // cleanup ALWAYS runs, best-effort per step, no recovery
  for (let i = 0; i < doc.cleanup.length; i++) {
    try {
      const step: NormalizedStep = {
        action: doc.cleanup[i]!.action,
        params: substitute(doc.cleanup[i]!.params, scope),
      };
      await executeStep(ctx, step, doc.steps.length + i);
    } catch {
      // cleanup failures never change the verdict
    }
  }

  await context.close().catch(() => {});

  return {
    status,
    durationMs: Date.now() - startedAt,
    usedFastPath,
    llmCalls,
    llmCostUsd,
    stepLog,
    screenshots,
    errorMessage,
  };
}
