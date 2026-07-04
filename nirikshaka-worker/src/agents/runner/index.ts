import type { AgentTask, Prisma, PrismaClient, TestCase } from "@prisma/client";
import type { TaskContext, TaskResult } from "../../tasks/registry";
import { isLlmConfigured } from "../../llm/client";
import { parseTestYaml } from "../../schema/test-yaml";
import { launchBrowser, type BrowserSession } from "./browser";
import { runCase } from "./case-runner";
import { charge, createBudget, isExceeded, toDecimal4, type CostBudget } from "./cost";
import { createRecoverFn } from "./recovery";
import { runPayloadSchema, type CaseOutcome, type RunPayload } from "./types";

/**
 * execute_run task (doc §5.3): whole run in-process, cases sequential in
 * Phase 2. At-least-once safe: the TestRun is found again via
 * report.taskId on re-claim — terminal runs dedupe, live runs resume
 * skipping cases that already have results, budget seeded from prior spend.
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

  let budget: CostBudget = createBudget(
    payload.maxCostUsd ?? config.RUNNER_MAX_COST_USD,
    Number(run.costUsd ?? 0)
  );
  const chargeLlm = (usd: number): boolean => {
    budget = charge(budget, usd);
    return !isExceeded(budget);
  };
  const recover = isLlmConfigured() ? createRecoverFn(chargeLlm) : undefined;

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

  try {
    for (const testCase of cases) {
      if (doneCaseIds.has(testCase.id)) continue;

      if (isExceeded(budget)) {
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
        continue;
      }

      const outcome = await runOne(
        { prisma, config, session, projectId, runId: run.id, recover, canSpendLlm: () => !isExceeded(budget) },
        testCase,
        payload
      );
      await writeResult(prisma, run.id, testCase.id, outcome);

      // Incremental spend persistence + claim-lease renewal between cases
      // (a slow run must survive the 300s stale-claim window).
      await prisma.testRun.update({
        where: { id: run.id },
        data: { costUsd: toDecimal4(budget.spentUsd) },
      });
      await prisma.agentTask
        .update({ where: { id: task.id }, data: { claimedAt: new Date() } })
        .catch(() => {});
    }
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
  };
  const runStatus = totals.failed > 0 ? "failed" : totals.error > 0 ? "error" : "passed";

  await prisma.testRun.update({
    where: { id: run.id },
    data: {
      status: runStatus,
      finishedAt: new Date(),
      totals: totals as unknown as Prisma.InputJsonValue,
      costUsd: toDecimal4(budget.spentUsd),
    },
  });

  // Auto-chain the Critic's truth check (doc §5.4).
  await prisma.agentTask.create({
    data: { type: "review_run", projectId, payload: { runId: run.id } },
  });

  return { runId: run.id, status: runStatus, ...totals, costUsd: toDecimal4(budget.spentUsd) };
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
  outcome: CaseOutcome
): Promise<void> {
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
    },
  });
}
