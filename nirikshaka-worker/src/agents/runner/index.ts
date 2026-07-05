import type { AgentTask, Prisma, PrismaClient, TestCase } from "@prisma/client";
import type { TaskContext, TaskResult } from "../../tasks/registry";
import { isLlmConfigured } from "../../llm/client";
import { parseTestYaml } from "../../schema/test-yaml";
import { launchBrowser, type BrowserSession } from "./browser";
import { runCase } from "./case-runner";
import { toDecimal4 } from "./cost";
import { createRecoverFn } from "./recovery";
import { CostLedger, finalizeCaseStatus } from "./retry";
import { runPool } from "../../util/pool";
import { runPayloadSchema, type CaseOutcome, type RunPayload } from "./types";

/**
 * execute_run task (doc §5.3, §7 Phase 4): runs cases across a bounded pool of
 * Playwright contexts (MAX_PARALLEL_CONTEXTS), retries a failed case once
 * (flaky flag), and stops dequeuing when the shared cost ledger trips.
 * At-least-once safe: the TestRun is found again via report.taskId on
 * re-claim — terminal runs dedupe, live runs resume skipping cases that
 * already have results, spend seeded from prior costUsd.
 */
export async function handleExecuteRun(task: AgentTask, ctx: TaskContext): Promise<TaskResult> {
  const { prisma, config } = ctx;
  const projectId = task.projectId;
  if (!projectId) throw new Error("execute_run: task.projectId is required");

  const payload = runPayloadSchema.parse(task.payload);

  let run = await prisma.testRun.findFirst({
    where: { report: { path: ["taskId"], equals: task.id } },
  });
  if (run && ["passed", "failed", "error", "cancelled"].includes(run.status)) {
    return { runId: run.id, status: run.status, resumed: true };
  }
  if (!run) {
    run = await prisma.testRun.create({
      data: {
        projectId,
        scope: payload.scope,
        scopeRef: payload.scopeRef ?? null,
        trigger: payload.trigger,
        status: "running",
        startedAt: new Date(),
        gitSha: payload.gitSha ?? null,
        report: { taskId: task.id, baseUrl: payload.baseUrl } as Prisma.InputJsonValue,
      },
    });
  }

  const cases = await selectCases(prisma, projectId, payload);
  if (cases.length === 0) {
    await prisma.testRun.update({
      where: { id: run.id },
      data: {
        status: "error",
        finishedAt: new Date(),
        totals: { cases: 0, passed: 0, failed: 0, skipped: 0 },
      },
    });
    throw new Error(
      `execute_run: no matching test cases (scope=${payload.scope}, ref=${payload.scopeRef ?? "-"})`
    );
  }

  // Resume support: skip cases that already produced a result in this run.
  const existingResults = await prisma.testCaseResult.findMany({
    where: { runId: run.id },
    select: { caseId: true },
  });
  const doneCaseIds = new Set(existingResults.map((r) => r.caseId));

  const ledger = new CostLedger(
    payload.maxCostUsd ?? config.RUNNER_MAX_COST_USD,
    Number(run.costUsd ?? 0)
  );
  const chargeLlm = (usd: number): boolean => ledger.add(usd);
  const recover = isLlmConfigured() ? createRecoverFn(chargeLlm) : undefined;
  const retries = config.RETRY_FAILED_CASES;

  let session: BrowserSession;
  try {
    session = await launchBrowser(config.RUNNER_HEADLESS);
  } catch (error: unknown) {
    const message = `playwright launch failed (is chromium installed? pnpm exec playwright install chromium): ${
      error instanceof Error ? error.message : String(error)
    }`;
    await prisma.testRun.update({
      where: { id: run.id },
      data: { status: "error", finishedAt: new Date() },
    });
    throw new Error(message);
  }

  const pending = cases.filter((c) => !doneCaseIds.has(c.id));
  const deps = { prisma, config, session, projectId, runId: run.id, recover, canSpendLlm: () => ledger.canSpend() };

  try {
    await runPool(pending, config.MAX_PARALLEL_CONTEXTS, async (testCase) => {
      // Ledger tripped mid-run → skip the rest (in-flight cases finish).
      if (ledger.tripped) {
        await writeResult(prisma, run.id, testCase.id, {
          status: "skipped",
          durationMs: 0,
          usedFastPath: true,
          llmCalls: 0,
          llmCostUsd: 0,
          stepLog: [],
          screenshots: [],
          errorMessage: "cost-cap-exceeded",
        });
        return;
      }

      // Attempt + one retry (fresh context each) → flaky classification.
      const attempts: CaseOutcome[] = [];
      for (let attempt = 0; attempt <= retries; attempt++) {
        attempts.push(await runOne(deps, testCase, payload));
        if (attempts[attempts.length - 1]!.status === "passed") break;
        if (ledger.tripped) break;
      }
      const finalized = finalizeCaseStatus(attempts);
      await writeResult(prisma, run.id, testCase.id, finalized.outcome, {
        flaky: finalized.flaky,
        attempts: finalized.attempts,
      });

      // Incremental spend + claim-lease renewal (survive the 300s stale window).
      await prisma.testRun
        .update({ where: { id: run.id }, data: { costUsd: toDecimal4(ledger.total) } })
        .catch(() => {});
      await prisma.agentTask
        .update({ where: { id: task.id }, data: { claimedAt: new Date() } })
        .catch(() => {});
    });
  } finally {
    await session.closeAll();
  }

  const results = await prisma.testCaseResult.findMany({ where: { runId: run.id } });
  const totals = {
    cases: results.length,
    passed: results.filter((r) => r.status === "passed").length,
    failed: results.filter((r) => r.status === "failed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    error: results.filter((r) => r.status === "error").length,
    flaky: results.filter((r) => (r.verdict as { flaky?: boolean } | null)?.flaky === true).length,
    skippedCostCap: results.filter((r) => r.errorMessage === "cost-cap-exceeded").length,
  };
  const runStatus = totals.failed > 0 ? "failed" : totals.error > 0 ? "error" : "passed";

  await prisma.testRun.update({
    where: { id: run.id },
    data: {
      status: runStatus,
      finishedAt: new Date(),
      totals: totals as unknown as Prisma.InputJsonValue,
      costUsd: toDecimal4(ledger.total),
    },
  });

  // Auto-chain the Critic's truth check (doc §5.4).
  await prisma.agentTask.create({
    data: { type: "review_run", projectId, payload: { runId: run.id } },
  });

  return { runId: run.id, status: runStatus, ...totals, costUsd: toDecimal4(ledger.total) };
}

async function runOne(
  deps: Parameters<typeof runCase>[0],
  testCase: TestCase,
  payload: RunPayload
): Promise<CaseOutcome> {
  let doc;
  try {
    doc = parseTestYaml(testCase.yaml);
  } catch (error: unknown) {
    return {
      status: "error",
      durationMs: 0,
      usedFastPath: true,
      llmCalls: 0,
      llmCostUsd: 0,
      stepLog: [],
      screenshots: [],
      errorMessage: `yaml invalid: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  try {
    return await runCase(deps, doc, { baseUrl: payload.baseUrl, data: payload.data });
  } catch (error: unknown) {
    return {
      status: "error",
      durationMs: 0,
      usedFastPath: true,
      llmCalls: 0,
      llmCostUsd: 0,
      stepLog: [],
      screenshots: [],
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

async function selectCases(
  prisma: PrismaClient,
  projectId: string,
  payload: RunPayload
): Promise<TestCase[]> {
  switch (payload.scope) {
    case "case":
      // explicit single case may target any status (incl. QUARANTINED)
      return prisma.testCase.findMany({
        where: { projectId, externalId: payload.scopeRef ?? "" },
      });
    case "suite":
      return prisma.testCase.findMany({
        where: { projectId, suite: payload.scopeRef ?? "", status: "ACTIVE" },
        orderBy: { externalId: "asc" },
      });
    case "tag":
      return prisma.testCase.findMany({
        where: { projectId, tags: { has: payload.scopeRef ?? "" }, status: "ACTIVE" },
        orderBy: { externalId: "asc" },
      });
    case "project":
      return prisma.testCase.findMany({
        where: { projectId, status: "ACTIVE" },
        orderBy: { externalId: "asc" },
      });
  }
}

async function writeResult(
  prisma: PrismaClient,
  runId: string,
  caseId: string,
  outcome: CaseOutcome,
  meta?: { flaky: boolean; attempts: number }
): Promise<void> {
  // The Truth Check overwrites verdict with the tri-state; seeding the flaky
  // flag here lets it survive (truth-check spreads the prior verdict) and the
  // Analyst read it. Only write a verdict when there's something to record.
  const verdict =
    meta?.flaky ? ({ flaky: true, attempts: meta.attempts } as Prisma.InputJsonValue) : undefined;
  await prisma.testCaseResult.create({
    data: {
      runId,
      caseId,
      status: outcome.status,
      durationMs: outcome.durationMs,
      usedFastPath: outcome.usedFastPath,
      llmCalls: outcome.llmCalls,
      llmCostUsd: toDecimal4(outcome.llmCostUsd),
      stepLog: outcome.stepLog as unknown as Prisma.InputJsonValue,
      screenshots: outcome.screenshots as unknown as Prisma.InputJsonValue,
      errorMessage: outcome.errorMessage ?? null,
      ...(verdict ? { verdict } : {}),
    },
  });
}
