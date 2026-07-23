"use server";

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { resolveUserCompany } from "@/app/dashboard/actions";
import { requireTeamRole } from "@/lib/team-auth";

/**
 * Test-cases review queue (doc §7 Phase 3). Reuses the Confirmation Gate
 * team-scoping pattern. Human is the only actor that activates a case
 * (needsReview:false, status ACTIVE) — see the worker write matrix.
 */

async function assertProjectInTeam(projectId: string): Promise<void> {
  const team = await resolveUserCompany();
  const project = await prisma.project.findFirst({
    where: { id: projectId, teamId: team.id },
    select: { id: true },
  });
  if (!project) throw new Error("Project not found");
}

async function assertCaseInTeam(caseId: string) {
  const team = await resolveUserCompany();
  // TestCase has no Prisma relation to Project (plain projectId) — scope
  // via a project lookup.
  const testCase = await prisma.testCase.findUnique({ where: { id: caseId } });
  if (!testCase) throw new Error("Test case not found");
  const project = await prisma.project.findFirst({
    where: { id: testCase.projectId, teamId: team.id },
    select: { id: true },
  });
  if (!project) throw new Error("Test case not found");
  return testCase;
}

async function teamProjectIds(): Promise<string[]> {
  const team = await resolveUserCompany();
  const projects = await prisma.project.findMany({
    where: { teamId: team.id },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

export interface CaseRow {
  id: string;
  externalId: string;
  name: string;
  suite: string;
  status: string;
  needsReview: boolean;
  confidence: string;
  tags: string[];
  yaml: string;
  needsHuman: boolean;
  quarantineReason: string | null;
  verdict: string | null;
  findings: { severity: string; claim: string; detail: string; suggestedFix?: string }[];
}

export interface SuiteGroup {
  suite: string;
  cases: CaseRow[];
}

export interface QueueResult {
  review: SuiteGroup[]; // DRAFT + needsReview, not needs-human
  needsHuman: CaseRow[];
  quarantined: CaseRow[];
  activeCount: number;
  hasConfirmedModel: boolean;
}

async function toRow(
  testCase: Awaited<ReturnType<typeof prisma.testCase.findMany>>[number]
): Promise<CaseRow> {
  const critique = await prisma.critique.findFirst({
    where: { targetType: "test_case", targetId: testCase.id },
    orderBy: { createdAt: "desc" },
  });
  return {
    id: testCase.id,
    externalId: testCase.externalId,
    name: testCase.name,
    suite: testCase.suite,
    status: testCase.status,
    needsReview: testCase.needsReview,
    confidence: testCase.confidence,
    tags: testCase.tags,
    yaml: testCase.yaml,
    needsHuman: testCase.tags.includes("needs-human"),
    quarantineReason: testCase.quarantineReason ?? null,
    verdict: critique?.verdict ?? null,
    findings: (critique?.findings ?? []) as CaseRow["findings"],
  };
}

export async function getTestCaseQueue(projectId: string): Promise<QueueResult> {
  await assertProjectInTeam(projectId);
  const [draft, quarantined, activeCount, confirmed] = await Promise.all([
    prisma.testCase.findMany({
      where: { projectId, status: "DRAFT", needsReview: true },
      orderBy: [{ suite: "asc" }, { externalId: "asc" }],
    }),
    prisma.testCase.findMany({
      where: { projectId, status: "QUARANTINED" },
      orderBy: { externalId: "asc" },
    }),
    prisma.testCase.count({ where: { projectId, status: "ACTIVE" } }),
    prisma.appModel.findFirst({
      where: { projectId, status: "CONFIRMED" },
      orderBy: { version: "desc" },
      select: { id: true },
    }),
  ]);

  const draftRows = await Promise.all(draft.map(toRow));
  const review = draftRows.filter((c) => !c.needsHuman);
  const needsHuman = draftRows.filter((c) => c.needsHuman);

  const bySuite = new Map<string, CaseRow[]>();
  for (const row of review) {
    const list = bySuite.get(row.suite) ?? [];
    list.push(row);
    bySuite.set(row.suite, list);
  }

  return {
    review: [...bySuite.entries()]
      .map(([suite, cases]) => ({ suite, cases }))
      .sort((a, b) => a.suite.localeCompare(b.suite)),
    needsHuman,
    quarantined: await Promise.all(quarantined.map(toRow)),
    activeCount,
    hasConfirmedModel: Boolean(confirmed),
  };
}

export async function approveTestCase(caseId: string) {
  await requireTeamRole(["OWNER", "ADMIN", "DEVELOPER"]); // VIEWERs cannot activate
  const testCase = await assertCaseInTeam(caseId);
  if (testCase.status !== "DRAFT") {
    throw new Error(`Only DRAFT cases can be approved (is ${testCase.status})`);
  }
  await prisma.testCase.update({
    where: { id: caseId },
    data: { status: "ACTIVE", needsReview: false },
  });
  return { ok: true as const };
}

export async function bulkApproveTestCases(caseIds: string[]) {
  await requireTeamRole(["OWNER", "ADMIN", "DEVELOPER"]); // VIEWERs cannot activate
  const projectIds = await teamProjectIds();
  // Never bulk-activate needs-human cases unless individually approved.
  const result = await prisma.testCase.updateMany({
    where: {
      id: { in: caseIds },
      status: "DRAFT",
      projectId: { in: projectIds },
      NOT: { tags: { has: "needs-human" } },
    },
    data: { status: "ACTIVE", needsReview: false },
  });
  return { ok: true as const, approved: result.count };
}

export async function rejectTestCase(caseId: string, mode: "retire" | "regenerate") {
  const testCase = await assertCaseInTeam(caseId);
  if (mode === "retire") {
    await prisma.testCase.update({ where: { id: caseId }, data: { status: "RETIRED" } });
    return { ok: true as const };
  }
  const critique = await prisma.critique.findFirst({
    where: { targetType: "test_case", targetId: caseId },
    orderBy: { createdAt: "desc" },
  });
  await prisma.agentTask.create({
    data: {
      type: "generate_tests",
      projectId: testCase.projectId,
      payload: {
        mode: "regenerate",
        cases: [
          {
            caseId,
            externalId: testCase.externalId,
            findings: (critique?.findings ?? []) as unknown[],
          },
        ],
      } as unknown as Prisma.InputJsonValue,
    },
  });
  return { ok: true as const, regenerating: true };
}

export async function unquarantineTestCase(caseId: string) {
  await assertCaseInTeam(caseId);
  await prisma.testCase.update({
    where: { id: caseId },
    data: { status: "ACTIVE", quarantinedAt: null, quarantineReason: null },
  });
  return { ok: true as const };
}

export async function runStrategist(projectId: string) {
  await assertProjectInTeam(projectId);
  const task = await prisma.agentTask.create({
    data: { type: "plan_strategy", projectId, payload: {} },
  });
  return { ok: true as const, taskId: task.id };
}
