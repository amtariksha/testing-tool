import { z } from "zod";
import type { AgentTask, Prisma } from "@prisma/client";
import type { TaskContext, TaskResult } from "../../tasks/registry";
import { appModelSchema } from "../../schema/app-model";
import { assertConfirmedModel } from "../guards";
import { applyBoundaries } from "./boundaries";
import { planStrategy } from "./plan";

const planStrategyPayloadSchema = z.object({
  /** Optional pin — must equal the latest CONFIRMED model if given. */
  appModelId: z.string().optional(),
});

/**
 * plan_strategy task (doc §7 Phase 3). Gate rule enforced at entry: only the
 * latest CONFIRMED model may feed a strategy. At-least-once: an existing
 * strategy for the same model created after this task skips regeneration.
 * Writes: TestStrategy create/supersede + agent_tasks only (write matrix).
 */
export async function handlePlanStrategy(
  task: AgentTask,
  ctx: TaskContext
): Promise<TaskResult> {
  const { prisma } = ctx;
  const projectId = task.projectId;
  if (!projectId) throw new Error("plan_strategy: task.projectId is required");

  const payload = planStrategyPayloadSchema.parse(task.payload);
  const appModel = await assertConfirmedModel(prisma, projectId);
  if (payload.appModelId && payload.appModelId !== appModel.id) {
    throw new Error(
      `plan_strategy: pinned model ${payload.appModelId} is no longer the latest CONFIRMED model`
    );
  }

  // Idempotency: a crashed-then-reclaimed task reuses its own output.
  const existing = await prisma.testStrategy.findFirst({
    where: { projectId, appModelId: appModel.id, createdAt: { gt: task.createdAt } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    await enqueueGenerate(prisma, projectId, existing.id);
    return { strategyId: existing.id, resumed: true };
  }

  const model = appModelSchema.parse(appModel.model);
  const { strategy: raw, costUsd } = await planStrategy(model);
  const strategy = applyBoundaries(
    { ...raw, appModelId: appModel.id, appModelVersion: appModel.version },
    model
  );

  const row = await prisma.$transaction(async (tx) => {
    await tx.testStrategy.updateMany({
      where: { projectId, status: "ACTIVE" },
      data: { status: "SUPERSEDED" },
    });
    return tx.testStrategy.create({
      data: {
        projectId,
        appModelId: appModel.id,
        strategy: strategy as unknown as Prisma.InputJsonValue,
        status: "ACTIVE",
      },
    });
  });

  await enqueueGenerate(prisma, projectId, row.id);

  return {
    strategyId: row.id,
    suites: strategy.suites.length,
    coverage: strategy.coverage.length,
    skipAgent: strategy.skip_agent.length,
    totalCaseBudget: strategy.totalCaseBudget,
    costUsd,
  };
}

async function enqueueGenerate(
  prisma: TaskContext["prisma"],
  projectId: string,
  strategyId: string
): Promise<void> {
  await prisma.agentTask.create({
    data: {
      type: "generate_tests",
      projectId,
      payload: { mode: "strategy", strategyId },
    },
  });
}
