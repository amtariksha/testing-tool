"use server";

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { resolveUserCompany } from "@/app/dashboard/actions";
import { getUser } from "@/app/auth/actions";
import type { AppModelDoc, Discrepancy } from "./types";

/**
 * Confirmation Gate server actions (implementation doc §4.3). All actions are
 * scoped to the caller's team; the gate rule (Strategist/Author refuse
 * non-CONFIRMED models) is enforced worker-side — here we manage review state.
 */

const ALLOWED_SCOUT_SOURCES = ["prd", "openapi"] as const;

async function assertProjectInTeam(projectId: string): Promise<void> {
  const team = await resolveUserCompany();
  const project = await prisma.project.findFirst({
    where: { id: projectId, teamId: team.id },
    select: { id: true },
  });
  if (!project) {
    throw new Error("Project not found");
  }
}

export async function getPilotProjects() {
  const team = await resolveUserCompany();
  return prisma.project.findMany({
    where: { teamId: team.id },
    select: { id: true, name: true, platform: true },
    orderBy: { name: "asc" },
  });
}

export async function getLatestAppModel(projectId: string) {
  await assertProjectInTeam(projectId);
  const appModel = await prisma.appModel.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
  });
  if (!appModel) {
    return null;
  }
  const critique = await prisma.critique.findFirst({
    where: { targetType: "app_model", targetId: appModel.id },
    orderBy: { createdAt: "desc" },
  });
  return { appModel, critique };
}

async function assertAppModelInTeam(appModelId: string) {
  const team = await resolveUserCompany();
  const appModel = await prisma.appModel.findFirst({
    where: { id: appModelId, project: { teamId: team.id } },
  });
  if (!appModel) {
    throw new Error("App model not found");
  }
  return { team, appModel };
}

export async function confirmAppModel(appModelId: string) {
  const { appModel } = await assertAppModelInTeam(appModelId);
  if (appModel.status === "CONFIRMED") {
    return { ok: true, alreadyConfirmed: true };
  }
  if (appModel.status !== "IN_REVIEW" && appModel.status !== "DRAFT") {
    throw new Error(`Cannot confirm a model in status ${appModel.status}`);
  }
  // Rejected features are the explicit re-mine signal — confirming over them
  // would bake a known-wrong model into test generation.
  const doc = appModel.model as unknown as AppModelDoc;
  const rejected = doc.features.filter((f) => f.review?.decision === "rejected");
  if (rejected.length > 0) {
    throw new Error(
      `Resolve or re-mine ${rejected.length} rejected feature(s) before confirming: ${rejected
        .map((f) => f.name)
        .join(", ")}`
    );
  }
  const user = await getUser();
  await prisma.appModel.update({
    where: { id: appModelId },
    data: {
      status: "CONFIRMED",
      confirmedBy: user?.email ?? null,
      confirmedAt: new Date(),
    },
  });
  return { ok: true };
}

export async function rejectAppModel(appModelId: string) {
  await assertAppModelInTeam(appModelId);
  await prisma.appModel.update({
    where: { id: appModelId },
    data: { status: "DRAFT" },
  });
  return { ok: true };
}

export interface ScoutTaskInfo {
  id: string;
  type: string;
  status: string;
  error: string | null;
  iteration: number;
  createdAt: Date;
  finishedAt: Date | null;
}

/**
 * The Scout→Critic pipeline state for a project: recent fuse_model /
 * review_model tasks, newest first. Polled by the Confirmation Gate so
 * progress (and critic-loop re-enqueues) survive page reloads. `error` is
 * safe to surface here — this path is team-scoped, unlike the ids-only
 * realtime channel.
 */
export async function getScoutPipeline(projectId: string): Promise<{
  tasks: ScoutTaskInfo[];
  active: boolean;
}> {
  await assertProjectInTeam(projectId);
  const rows = await prisma.agentTask.findMany({
    where: { projectId, type: { in: ["fuse_model", "review_model"] } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: {
      id: true,
      type: true,
      status: true,
      error: true,
      payload: true,
      createdAt: true,
      finishedAt: true,
    },
  });
  const tasks = rows.map((row) => {
    const payload = (row.payload ?? {}) as { iteration?: number };
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      error: row.error,
      iteration: typeof payload.iteration === "number" ? payload.iteration : 1,
      createdAt: row.createdAt,
      finishedAt: row.finishedAt,
    };
  });
  return {
    tasks,
    active: tasks.some((t) => t.status === "queued" || t.status === "claimed"),
  };
}

interface ScoutSourceInput {
  type: (typeof ALLOWED_SCOUT_SOURCES)[number];
  content: string;
}

export async function runScout(projectId: string, sources: ScoutSourceInput[]) {
  await assertProjectInTeam(projectId);
  const clean = sources
    .filter((s) => ALLOWED_SCOUT_SOURCES.includes(s.type) && s.content.trim().length > 0)
    .map((s) => ({ type: s.type, content: s.content }));

  const task = await prisma.agentTask.create({
    data: {
      type: "fuse_model",
      projectId,
      payload: { sources: clean },
    },
  });
  return { ok: true, taskId: task.id };
}

// ── Confirmation Gate v2 (doc §4.3) ───────────────────────────────────────
// All review state lives inside AppModel.model Json using fields declared in
// the worker schema (nirikshaka-worker/src/schema/app-model.ts) — anything
// else would be stripped on the worker's next parse. Mutations are
// read-modify-write, last-write-wins: acceptable for the single-reviewer
// pilot.

/** Guarded read-modify-write on the LATEST, non-CONFIRMED model version. */
async function mutateLatestModelDoc(
  appModelId: string,
  mutate: (doc: AppModelDoc) => AppModelDoc
): Promise<void> {
  const { appModel } = await assertAppModelInTeam(appModelId);
  if (appModel.status === "CONFIRMED") {
    throw new Error("Model is CONFIRMED — re-run Scout to change it");
  }
  const latest = await prisma.appModel.findFirst({
    where: { projectId: appModel.projectId },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  if (latest && latest.id !== appModelId) {
    throw new Error("Only the latest model version can be edited");
  }
  const next = mutate(appModel.model as unknown as AppModelDoc);
  await prisma.appModel.update({
    where: { id: appModelId },
    data: { model: next as unknown as Prisma.InputJsonValue },
  });
}

async function reviewerEmail(): Promise<string | undefined> {
  const user = await getUser();
  return user?.email ?? undefined;
}

export async function reviewFeature(
  appModelId: string,
  featureId: string,
  review: { decision?: "approved" | "rejected"; criticalPath?: boolean; note?: string }
) {
  const by = await reviewerEmail();
  await mutateLatestModelDoc(appModelId, (doc) => ({
    ...doc,
    features: doc.features.map((f) =>
      f.id === featureId
        ? { ...f, review: { ...f.review, ...review, by, at: new Date().toISOString() } }
        : f
    ),
  }));
  return { ok: true as const };
}

export async function editFeature(
  appModelId: string,
  featureId: string,
  patch: { name?: string; roles?: string[]; screens?: string[]; apis?: string[]; states?: string[] }
) {
  const by = await reviewerEmail();
  await mutateLatestModelDoc(appModelId, (doc) => ({
    ...doc,
    features: doc.features.map((f) =>
      f.id === featureId
        ? {
            ...f,
            ...patch,
            review: { ...f.review, edited: true, by, at: new Date().toISOString() },
          }
        : f
    ),
  }));
  return { ok: true as const };
}

export async function resolveDiscrepancy(appModelId: string, index: number, resolution: string) {
  const { appModel } = await assertAppModelInTeam(appModelId);
  if (appModel.status === "CONFIRMED") {
    throw new Error("Model is CONFIRMED — re-run Scout to change it");
  }
  const discrepancies = (appModel.discrepancies ?? []) as unknown as Discrepancy[];
  if (index < 0 || index >= discrepancies.length) {
    throw new Error("Discrepancy not found");
  }
  const by = await reviewerEmail();
  const next = discrepancies.map((d, i) =>
    i === index
      ? { ...d, resolution, resolvedBy: by, resolvedAt: new Date().toISOString() }
      : d
  );
  await prisma.appModel.update({
    where: { id: appModelId },
    data: { discrepancies: next as unknown as Prisma.InputJsonValue },
  });
  return { ok: true as const };
}

export async function answerQuestion(appModelId: string, questionId: string, answer: string) {
  if (answer.trim().length === 0) {
    throw new Error("Answer cannot be empty");
  }
  const by = await reviewerEmail();
  await mutateLatestModelDoc(appModelId, (doc) => ({
    ...doc,
    targeted_questions: (doc.targeted_questions ?? []).map((q) =>
      q.id === questionId
        ? { ...q, answer: { text: answer.trim(), by, at: new Date().toISOString() } }
        : q
    ),
  }));
  return { ok: true as const };
}

/**
 * Collect answered questions and enqueue a fresh fuse_model carrying the
 * original sources plus the answers (they become human evidence, doc §4.3).
 * iteration resets to 1: a human-informed run is a new generation, not a
 * critic retry.
 */
export async function submitAnswersAndRefuse(appModelId: string) {
  const { appModel } = await assertAppModelInTeam(appModelId);
  const doc = appModel.model as unknown as AppModelDoc;
  const answered = (doc.targeted_questions ?? []).filter((q) => q.answer?.text);
  if (answered.length === 0) {
    throw new Error("Answer at least one question before re-fusing");
  }

  // Recover the original sources from the newest fuse_model task. Assumes
  // agent_tasks rows are not pruned (true today) — if pruning ever lands,
  // snapshot sources onto the model instead.
  const lastFuse = await prisma.agentTask.findFirst({
    where: { projectId: appModel.projectId, type: "fuse_model" },
    orderBy: { createdAt: "desc" },
    select: { payload: true },
  });
  const sources = ((lastFuse?.payload ?? {}) as { sources?: unknown[] }).sources ?? [];

  const task = await prisma.agentTask.create({
    data: {
      type: "fuse_model",
      projectId: appModel.projectId,
      payload: {
        sources,
        iteration: 1,
        answers: answered.map((q) => ({
          questionId: q.id,
          question: q.question,
          answer: q.answer!.text,
          featureId: q.featureId,
          by: q.answer!.by,
        })),
      } as unknown as Prisma.InputJsonValue,
    },
  });
  return { ok: true as const, taskId: task.id };
}
