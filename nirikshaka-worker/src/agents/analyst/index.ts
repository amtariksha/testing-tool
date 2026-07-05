import { z } from "zod";
import type { AgentTask, Prisma, PrismaClient } from "@prisma/client";
import type { TaskContext, TaskResult } from "../../tasks/registry";
import { appModelSchema } from "../../schema/app-model";
import { buildRunNotification, sendWacrmNotification, shouldNotify } from "../../notify/wacrm";
import { detectFlakes, type CaseRunHistory } from "./flake";
import { findCostOutliers, type CostSample } from "./cost";
import { computeDrift, type LocatorSample } from "./locator-drift";
import { diffTelemetryVsModel } from "./staleness";
import { observeTelemetry } from "./sql-queries";

const analyzeRunPayloadSchema = z.object({
  runId: z.string().optional(),
  sweep: z.boolean().optional(),
});

/**
 * analyze_run task (doc §4.4, §7 Phase 4) — LLM-free detection. runId mode
 * (chained after review_run) reports per-run cost/flake signals; sweep mode
 * (scheduled) quarantines chronic flakes, reports drift/cost, and flips a
 * CONFIRMED model to STALE on a material telemetry diff. Write matrix:
 * Critique create, TestCase.status→QUARANTINED (+reason), AppModel
 * CONFIRMED→STALE only.
 */
export async function handleAnalyzeRun(task: AgentTask, ctx: TaskContext): Promise<TaskResult> {
  const { prisma, sql, config } = ctx;
  const projectId = task.projectId;
  if (!projectId) throw new Error("analyze_run: task.projectId is required");

  const { runId, sweep } = analyzeRunPayloadSchema.parse(task.payload);

  if (runId && !sweep) {
    return analyzeSingleRun(prisma, projectId, runId, config);
  }
  return analyzeSweep(ctx, projectId);
}

async function analyzeSingleRun(
  prisma: PrismaClient,
  projectId: string,
  runId: string,
  config: TaskContext["config"]
): Promise<TaskResult> {
  const results = await prisma.testCaseResult.findMany({ where: { runId } });
  const costSamples: CostSample[] = results.map((r) => ({
    caseId: r.caseId,
    externalId: r.caseId,
    llmCostUsd: Number(r.llmCostUsd ?? 0),
  }));
  const outliers = findCostOutliers(costSamples, {
    z: config.COST_OUTLIER_Z,
    minUsd: config.COST_OUTLIER_MIN_USD,
  });
  const retryFlakes = results.filter(
    (r) => (r.verdict as { flaky?: boolean } | null)?.flaky === true
  ).length;

  if (outliers.length > 0 || retryFlakes > 0) {
    await prisma.critique.create({
      data: {
        projectId,
        targetType: "test_run",
        targetId: runId,
        verdict: "info",
        findings: {
          costOutliers: outliers.slice(0, 5),
          retryFlakes,
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }
  return { runId, costOutliers: outliers.length, retryFlakes };
}

async function analyzeSweep(ctx: TaskContext, projectId: string): Promise<TaskResult> {
  const { prisma, sql, config } = ctx;

  // ── Flake detection → quarantine ──
  const recentRuns = await prisma.testRun.findMany({
    where: { projectId, status: { in: ["passed", "failed"] } },
    orderBy: { startedAt: "desc" },
    take: config.FLAKE_WINDOW_RUNS,
    select: { id: true },
  });
  const runIds = recentRuns.map((r) => r.id);
  const results = await prisma.testCaseResult.findMany({
    where: { runId: { in: runIds } },
    orderBy: { id: "desc" },
  });
  const byCase = new Map<string, CaseRunHistory>();
  for (const r of results) {
    const entry = byCase.get(r.caseId) ?? {
      caseId: r.caseId,
      externalId: r.caseId,
      results: [],
    };
    entry.results.push({
      status: r.status,
      flaky: (r.verdict as { flaky?: boolean } | null)?.flaky === true,
    });
    byCase.set(r.caseId, entry);
  }
  const flakes = detectFlakes([...byCase.values()], {
    windowRuns: config.FLAKE_WINDOW_RUNS,
    minSamples: config.FLAKE_MIN_SAMPLES,
    rateThreshold: config.FLAKE_RATE_THRESHOLD,
  });
  let quarantined = 0;
  for (const flake of flakes.filter((f) => f.chronic)) {
    const testCase = await prisma.testCase.findUnique({ where: { id: flake.caseId } });
    if (!testCase || testCase.status === "QUARANTINED") continue;
    const reason = `flaky: flipRate ${flake.flipRate.toFixed(2)}, ${flake.retryFlakes}/${flake.samples} retry-passes`;
    await prisma.testCase.update({
      where: { id: flake.caseId },
      data: { status: "QUARANTINED", quarantinedAt: new Date(), quarantineReason: reason },
    });
    await prisma.critique.create({
      data: {
        projectId,
        targetType: "test_case",
        targetId: flake.caseId,
        verdict: "quarantined",
        findings: [{ severity: "high", claim: `case:${testCase.externalId}`, detail: reason }] as unknown as Prisma.InputJsonValue,
      },
    });
    quarantined++;
  }

  // ── Locator drift + cost report (date-keyed, check-before-create) ──
  const cacheRows = await prisma.locatorCache.findMany({ where: { projectId } });
  const driftSamples: LocatorSample[] = cacheRows.map((row) => ({
    semanticKey: row.semanticKey,
    confidence: Number(row.confidence ?? 1),
    recoveryCount: 0, // recovery-frequency mining is a later refinement
  }));
  const drift = computeDrift(driftSamples, {
    confidenceThreshold: config.DRIFT_CONFIDENCE_THRESHOLD,
    recoveryThreshold: 3,
  });
  const costOutliers = findCostOutliers(
    results.map((r) => ({ caseId: r.caseId, externalId: r.caseId, llmCostUsd: Number(r.llmCostUsd ?? 0) })),
    { z: config.COST_OUTLIER_Z, minUsd: config.COST_OUTLIER_MIN_USD }
  );
  const reportId = `${projectId}:${new Date().toISOString().slice(0, 10)}`;
  const existingReport = await prisma.critique.findFirst({
    where: { targetType: "analysis_report", targetId: reportId },
  });
  if (!existingReport && (drift.length > 0 || costOutliers.length > 0)) {
    await prisma.critique.create({
      data: {
        projectId,
        targetType: "analysis_report",
        targetId: reportId,
        verdict: "info",
        findings: { drift: drift.slice(0, 20), costOutliers: costOutliers.slice(0, 10) } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // ── Staleness → STALE ──
  const model = await prisma.appModel.findFirst({
    where: { projectId, status: "CONFIRMED" },
    orderBy: { version: "desc" },
  });
  let staleFlipped = false;
  let stalenessDiff: unknown = null;
  if (model) {
    const observed = await observeTelemetry(sql, projectId, 7);
    const diff = diffTelemetryVsModel(appModelSchema.parse(model.model), observed, {
      flowShiftThreshold: config.STALENESS_FLOW_SHIFT,
      minTransitionSupport: 10,
      materialNewCount: 2,
    });
    if (diff.material) {
      await prisma.appModel.update({ where: { id: model.id }, data: { status: "STALE" } });
      await prisma.critique.create({
        data: {
          projectId,
          targetType: "app_model",
          targetId: model.id,
          verdict: "stale",
          findings: diff as unknown as Prisma.InputJsonValue,
        },
      });
      staleFlipped = true;
      stalenessDiff = diff;
    }
  }

  // ── WhatsApp sweep summary ──
  if (shouldNotify({ failed: quarantined, amber: staleFlipped ? 1 : 0 })) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    const findings: string[] = [];
    if (quarantined > 0) findings.push(`${quarantined} case(s) quarantined (flaky)`);
    if (staleFlipped) findings.push("app model marked STALE — re-run Scout");
    const payload = buildRunNotification({
      runId: `sweep-${reportId}`,
      projectId,
      projectName: project?.name ?? projectId,
      verdict: staleFlipped ? "STALE" : "QUARANTINE",
      totals: { total: 0, passed: 0, failed: quarantined, skipped: 0, amber: staleFlipped ? 1 : 0 },
      costUsd: 0,
      scope: "analyst-sweep",
      topFindings: findings,
      dashboardUrl: config.DASHBOARD_URL,
    });
    await sendWacrmNotification(config, payload);
  }

  return { sweep: true, quarantined, drift: drift.length, costOutliers: costOutliers.length, stale: staleFlipped, stalenessDiff };
}
