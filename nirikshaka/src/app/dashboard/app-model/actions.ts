"use server";

import prisma from "@/lib/prisma";
import { resolveUserCompany } from "@/app/dashboard/actions";
import { getUser } from "@/app/auth/actions";

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
