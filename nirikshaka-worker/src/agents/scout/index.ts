import { z } from "zod";
import type { AgentTask, Prisma } from "@prisma/client";
import type { TaskContext, TaskResult } from "../../tasks/registry";
import { mineFlows } from "./flow-miner";
import { mineApiChains } from "./api-chain-miner";
import { mineSpec, type SpecSource } from "./spec-miner";
import { fuse } from "./fuse";
import type { ModelFragment } from "./types";

const specSourceSchema = z.object({
  type: z.enum(["prd", "openapi"]),
  content: z.string().min(1),
});

const fuseModelPayloadSchema = z.object({
  sources: z.array(specSourceSchema).default([]),
  sinceDays: z.number().int().positive().optional(),
});

/**
 * fuse_model task (Scout orchestrator): mine telemetry + spec sources, fuse into
 * one app model, write a DRAFT AppModel row, and enqueue Critic review.
 */
export async function handleFuseModel(
  task: AgentTask,
  ctx: TaskContext
): Promise<TaskResult> {
  const { prisma, sql } = ctx;
  const projectId = task.projectId;
  if (!projectId) {
    throw new Error("fuse_model: task.projectId is required");
  }

  const { sources, sinceDays } = fuseModelPayloadSchema.parse(task.payload);

  const fragments: ModelFragment[] = [];
  let costUsd = 0;

  // Telemetry miners (raw SQL) — empty until the app is instrumented.
  const flowOpts = sinceDays ? { sinceDays } : {};
  const [flowFrag, apiFrag] = await Promise.all([
    mineFlows(sql, projectId, flowOpts),
    mineApiChains(sql, projectId, sinceDays ? { sinceDays } : {}),
  ]);
  fragments.push(flowFrag, apiFrag);

  // Spec miner (LLM) — the primary source for the spec-first pilot.
  if (sources.length > 0) {
    const { fragment, costUsd: specCost } = await mineSpec(sources as SpecSource[]);
    fragments.push(fragment);
    costUsd += specCost;
  }

  const fused = fuse(fragments);

  const latest = await prisma.appModel.findFirst({
    where: { projectId },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const version = (latest?.version ?? 0) + 1;

  const appModel = await prisma.appModel.create({
    data: {
      projectId,
      version,
      status: "DRAFT",
      model: fused.model as unknown as Prisma.InputJsonValue,
      evidence: fused.evidence as unknown as Prisma.InputJsonValue,
      discrepancies: fused.discrepancies as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.agentTask.create({
    data: {
      type: "review_model",
      projectId,
      payload: { appModelId: appModel.id },
    },
  });

  return {
    appModelId: appModel.id,
    version,
    features: fused.model.features.length,
    screens: fused.model.screens.length,
    flows: fused.model.flows.length,
    apiChains: fused.model.apiChains.length,
    discrepancies: fused.discrepancies.length,
    costUsd,
  };
}
