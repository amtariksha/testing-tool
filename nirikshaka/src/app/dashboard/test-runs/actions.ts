"use server";

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { resolveUserCompany } from "@/app/dashboard/actions";

/**
 * Test-runs server actions (doc §5.5). Prisma Decimals are converted with
 * Number() before crossing the RSC boundary.
 */

async function assertProjectInTeam(projectId: string): Promise<void> {
  const team = await resolveUserCompany();
  const project = await prisma.project.findFirst({
    where: { id: projectId, teamId: team.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");
}

export interface TestRunRow {
  id: string;
  scope: string;
  scopeRef: string | null;
  trigger: string;
  status: string;
  verdict: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  totals: Record<string, number> | null;
  costUsd: number;
  gitSha: string | null;
}

export async function getTestRuns(projectId: string): Promise<TestRunRow[]> {
  await assertProjectInTeam(projectId);
  const runs = await prisma.testRun.findMany({
    where: { projectId },
    orderBy: { startedAt: "desc" },
    take: 25,
  });
  return runs.map((run) => ({
    id: run.id,
    scope: run.scope,
    scopeRef: run.scopeRef,
    trigger: run.trigger,
    status: run.status,
    verdict: ((run.report ?? {}) as { verdict?: string }).verdict ?? null,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    totals: (run.totals ?? null) as Record<string, number> | null,
    costUsd: Number(run.costUsd ?? 0),
    gitSha: run.gitSha,
  }));
}

export interface CaseResultRow {
  id: string;
  caseId: string;
  externalId: string;
  name: string;
  status: string;
  durationMs: number | null;
  usedFastPath: boolean;
  llmCalls: number;
  llmCostUsd: number;
  stepLog: unknown[];
  screenshots: string[];
  verdict: Record<string, unknown> | null;
  errorMessage: string | null;
}

export async function getTestRun(runId: string) {
  const team = await resolveUserCompany();
  // TestRun has no Prisma relation to Project (plain projectId column) —
  // team-scope via a second lookup.
  const run = await prisma.testRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("Run not found");
  const project = await prisma.project.findFirst({
    where: { id: run.projectId, teamId: team.id },
    select: { name: true },
  });
  if (!project) throw new Error("Run not found");

  const results = await prisma.testCaseResult.findMany({
    where: { runId },
    orderBy: { id: "asc" },
  });
  const cases = await prisma.testCase.findMany({
    where: { id: { in: results.map((r) => r.caseId) } },
    select: { id: true, externalId: true, name: true },
  });
  const caseById = new Map(cases.map((c) => [c.id, c]));

  return {
    run: {
      id: run.id,
      projectName: project.name,
      scope: run.scope,
      scopeRef: run.scopeRef,
      trigger: run.trigger,
      status: run.status,
      verdict: ((run.report ?? {}) as { verdict?: string }).verdict ?? null,
      baseUrl: ((run.report ?? {}) as { baseUrl?: string }).baseUrl ?? null,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      totals: (run.totals ?? null) as Record<string, number> | null,
      costUsd: Number(run.costUsd ?? 0),
      gitSha: run.gitSha,
    },
    results: results.map((r): CaseResultRow => {
      const testCase = caseById.get(r.caseId);
      return {
        id: r.id,
        caseId: r.caseId,
        externalId: testCase?.externalId ?? "?",
        name: testCase?.name ?? "unknown case",
        status: r.status,
        durationMs: r.durationMs,
        usedFastPath: r.usedFastPath,
        llmCalls: r.llmCalls,
        llmCostUsd: Number(r.llmCostUsd ?? 0),
        stepLog: (r.stepLog ?? []) as unknown[],
        screenshots: (r.screenshots ?? []) as string[],
        verdict: (r.verdict ?? null) as Record<string, unknown> | null,
        errorMessage: r.errorMessage,
      };
    }),
  };
}

export async function getSuitesAndTags(projectId: string) {
  await assertProjectInTeam(projectId);
  const cases = await prisma.testCase.findMany({
    where: { projectId, status: "ACTIVE" },
    select: { suite: true, tags: true },
  });
  return {
    suites: [...new Set(cases.map((c) => c.suite))].sort(),
    tags: [...new Set(cases.flatMap((c) => c.tags))].sort(),
    activeCases: cases.length,
  };
}

export async function enqueueTestRun(input: {
  projectId: string;
  scope: "project" | "suite" | "tag";
  scopeRef?: string;
  baseUrl: string;
  data?: Record<string, string>;
  maxCostUsd?: number;
}) {
  await assertProjectInTeam(input.projectId);
  if (!input.baseUrl.trim()) throw new Error("Base URL is required");
  const task = await prisma.agentTask.create({
    data: {
      type: "execute_run",
      projectId: input.projectId,
      payload: {
        scope: input.scope,
        ...(input.scopeRef ? { scopeRef: input.scopeRef } : {}),
        baseUrl: input.baseUrl.trim(),
        trigger: "manual",
        ...(input.data && Object.keys(input.data).length > 0 ? { data: input.data } : {}),
        ...(input.maxCostUsd ? { maxCostUsd: input.maxCostUsd } : {}),
      } as Prisma.InputJsonValue,
    },
  });
  return { ok: true as const, taskId: task.id };
}
