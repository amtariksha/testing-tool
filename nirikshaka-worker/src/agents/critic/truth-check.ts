import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { AgentTask } from "@prisma/client";
import type { TaskContext, TaskResult } from "../../tasks/registry";
import { apiSucceededSchema, parseTestYaml, type VerifyBackend } from "../../schema/test-yaml";
import { buildRunNotification, sendWacrmNotification, shouldNotify } from "../../notify/wacrm";
import { find5xx, findCrashes, findMatchingRequest, findUiErrors } from "./telemetry-queries";
import { computeCaseVerdict, rollupRunVerdict, type TriState } from "./verdict";

const reviewRunPayloadSchema = z.object({ runId: z.string() });

const DEFAULT_VERIFY: VerifyBackend = {
  window_ms: 8000,
  expect: ["no_5xx", "no_new_crashes"],
};

/**
 * review_run task — the Critic's Truth Check (doc §5.4). Cross-references
 * the run's time window against telemetry (projectId-scoped; attribution by
 * window is the accepted dogfood tradeoff — the x-nirikshaka-test-session
 * header is already emitted for a future request-level join). Idempotent:
 * verdicts recompute safely; notification is flag-guarded in report.notify.
 */
export async function handleReviewRun(task: AgentTask, ctx: TaskContext): Promise<TaskResult> {
  const { prisma, sql } = ctx;
  const { runId } = reviewRunPayloadSchema.parse(task.payload);

  const run = await prisma.testRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error(`review_run: TestRun ${runId} not found`);
  const results = await prisma.testCaseResult.findMany({ where: { runId } });
  const cases = await prisma.testCase.findMany({
    where: { id: { in: results.map((r) => r.caseId) } },
  });
  const caseById = new Map(cases.map((c) => [c.id, c]));

  const startedAt = run.startedAt ?? new Date();
  const finishedAt = run.finishedAt ?? new Date();

  // Per-case verify_backend (plus api_call_succeeded entries from the
  // assertions block, PRD §5.2) — falls back to the safe default.
  const verifyByCase = new Map<string, VerifyBackend>();
  for (const testCase of cases) {
    try {
      const doc = parseTestYaml(testCase.yaml);
      const extraExpects = doc.assertions
        .map((a) => a["api_call_succeeded"])
        .filter(Boolean)
        .map((raw) => {
          const parsed = apiSucceededSchema.safeParse(
            typeof raw === "object" && raw !== null && "url_contains" in (raw as object)
              ? { ...(raw as object), path_contains: (raw as { url_contains: string }).url_contains }
              : raw
          );
          return parsed.success ? { api_succeeded: parsed.data } : null;
        })
        .filter((e): e is { api_succeeded: z.infer<typeof apiSucceededSchema> } => e !== null);
      const verify = doc.verify_backend ?? DEFAULT_VERIFY;
      verifyByCase.set(testCase.id, {
        ...verify,
        expect: [...verify.expect, ...extraExpects],
      });
    } catch {
      verifyByCase.set(testCase.id, DEFAULT_VERIFY);
    }
  }

  const maxWindowMs = Math.max(
    8000,
    ...[...verifyByCase.values()].map((v) => v.window_ms)
  );
  const windowEnd = new Date(finishedAt.getTime() + maxWindowMs);

  const [http5xx, crashes, uiErrors] = await Promise.all([
    find5xx(sql, run.projectId, startedAt, windowEnd),
    findCrashes(sql, run.projectId, startedAt, windowEnd),
    findUiErrors(sql, run.projectId, startedAt, windowEnd),
  ]);

  const caseSummaries: Array<{
    caseId: string;
    externalId: string;
    name: string;
    status: string;
    verdict: TriState | null;
  }> = [];
  const finals: TriState[] = [];
  let amber = 0;

  for (const result of results) {
    const testCase = caseById.get(result.caseId);
    const verify = verifyByCase.get(result.caseId) ?? DEFAULT_VERIFY;

    let verdictJson: Prisma.InputJsonValue | null = null;
    let final: TriState | null = null;

    if (result.status === "skipped") {
      final = null; // skipped cases carry no verdict
    } else {
      const expectations = [];
      for (const entry of verify.expect) {
        if (typeof entry === "object" && "api_succeeded" in entry) {
          const matched = await findMatchingRequest(
            sql,
            run.projectId,
            startedAt,
            windowEnd,
            entry.api_succeeded
          );
          expectations.push({ expect: entry.api_succeeded, matched });
        }
      }
      const checkNo5xx = verify.expect.includes("no_5xx");
      const checkCrashes = verify.expect.includes("no_new_crashes");
      const verdict = computeCaseVerdict({
        uiPassed: result.status === "passed",
        http5xx: checkNo5xx ? http5xx : [],
        crashes: checkCrashes ? crashes : [],
        uiErrors: checkNo5xx || checkCrashes ? uiErrors : [],
        expectations,
      });
      final = verdict.final;
      verdictJson = {
        ...verdict,
        windowMs: verify.window_ms,
        checkedAt: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue;
      finals.push(verdict.final);
      if (verdict.final === "AMBER") amber += 1;
    }

    await prisma.testCaseResult.update({
      where: { id: result.id },
      data: { verdict: verdictJson ?? Prisma.JsonNull },
    });

    caseSummaries.push({
      caseId: result.caseId,
      externalId: testCase?.externalId ?? "?",
      name: testCase?.name ?? "?",
      status: result.status,
      verdict: final,
    });
  }

  const runVerdict = rollupRunVerdict(finals);
  const priorReport = (run.report ?? {}) as Record<string, unknown>;
  const totals = {
    ...((run.totals ?? {}) as Record<string, unknown>),
    amber,
  };

  // WhatsApp notify (doc §5.5), flag-first so a re-claimed task can't
  // double-ping: the flag is persisted with the report BEFORE the POST.
  const failed = Number((totals as { failed?: number }).failed ?? 0);
  const alreadyNotified = Boolean(
    (priorReport.notify as { sent?: boolean } | undefined)?.sent
  );
  const wantNotify = shouldNotify({ failed, amber }) && !alreadyNotified;

  const report: Record<string, unknown> = {
    ...priorReport, // preserves taskId (idempotency anchor) + baseUrl
    verdict: runVerdict,
    totals,
    cases: caseSummaries,
    ...(wantNotify ? { notify: { sent: true, at: new Date().toISOString() } } : {}),
  };

  await prisma.testRun.update({
    where: { id: runId },
    data: {
      report: report as unknown as Prisma.InputJsonValue,
      totals: totals as unknown as Prisma.InputJsonValue,
    },
  });

  if (wantNotify) {
    const project = await prisma.project.findUnique({
      where: { id: run.projectId },
      select: { name: true },
    });
    const topFindings = caseSummaries
      .filter((c) => c.status === "failed" || c.verdict === "AMBER")
      .slice(0, 2)
      .map((c) => `${c.externalId} (${c.verdict ?? c.status})`);
    const payload = buildRunNotification({
      runId,
      projectId: run.projectId,
      projectName: project?.name ?? run.projectId,
      verdict: runVerdict,
      totals: {
        total: caseSummaries.length,
        passed: Number((totals as { passed?: number }).passed ?? 0),
        failed,
        skipped: Number((totals as { skipped?: number }).skipped ?? 0),
        amber,
      },
      costUsd: Number(run.costUsd ?? 0),
      scope: run.scope,
      scopeRef: run.scopeRef,
      topFindings,
      dashboardUrl: ctx.config.DASHBOARD_URL,
    });
    await sendWacrmNotification(ctx.config, payload);
  }

  return { runId, verdict: runVerdict, amber, cases: caseSummaries.length, notified: wantNotify };
}
