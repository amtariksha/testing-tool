import { z } from "zod";
import type { AgentTask } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { TaskContext, TaskResult } from "../../tasks/registry";
import { appModelSchema } from "../../schema/app-model";
import { reviewModel } from "./review-model";
import { decideNextStep } from "./loop";

const reviewModelPayloadSchema = z.object({
  appModelId: z.string(),
  /** Threaded by Scout so a rejection can re-enqueue fuse_model (gap 5). */
  sources: z.array(z.unknown()).default([]),
  /** Absent on legacy queued tasks — fall back to the critique count. */
  iteration: z.number().int().min(1).optional(),
});

/**
 * review_model task: Critic reviews a DRAFT app model, writes a Critique row,
 * and either advances the model to IN_REVIEW or (rejected, iteration < 3)
 * sends Scout back to re-mine with the findings as guidance. Permission gate:
 * the Critic never edits model content — only Critique rows, status flips,
 * and task enqueues.
 */
export async function handleReviewModel(
  task: AgentTask,
  ctx: TaskContext
): Promise<TaskResult> {
  const payload = reviewModelPayloadSchema.parse(task.payload);
  const { appModelId, sources } = payload;
  const { prisma } = ctx;

  const appModel = await prisma.appModel.findUnique({ where: { id: appModelId } });
  if (!appModel) {
    throw new Error(`review_model: AppModel ${appModelId} not found`);
  }

  const priorCritiques = await prisma.critique.count({
    where: { targetType: "app_model", targetId: appModelId },
  });
  const iteration = payload.iteration ?? priorCritiques + 1;

  // At-least-once guard: a crashed-then-reclaimed task must not re-bill the
  // LLM, write a duplicate Critique, or re-enqueue a duplicate fuse — this is
  // what caps loop amplification.
  if (priorCritiques >= iteration) {
    return { skipped: "already-reviewed", iteration };
  }

  const model = appModelSchema.parse(appModel.model);
  const { review, costUsd } = await reviewModel(model);

  await prisma.critique.create({
    data: {
      projectId: appModel.projectId,
      targetType: "app_model",
      targetId: appModelId,
      verdict: review.verdict,
      findings: review.findings as unknown as Prisma.InputJsonValue,
      iteration,
    },
  });

  const decision = decideNextStep(review.verdict, iteration);
  await prisma.appModel.update({
    where: { id: appModelId },
    data: { status: decision.nextStatus },
  });

  if (decision.reenqueueFuse) {
    await prisma.agentTask.create({
      data: {
        type: "fuse_model",
        projectId: appModel.projectId,
        payload: {
          sources,
          iteration: iteration + 1,
          guidance: review.findings.filter(
            (f) => f.severity === "critical" || f.severity === "high"
          ),
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return {
    verdict: review.verdict,
    findingCount: review.findings.length,
    status: decision.nextStatus,
    iteration,
    reenqueuedFuse: decision.reenqueueFuse,
    escalated: decision.escalated,
    costUsd,
  };
}
