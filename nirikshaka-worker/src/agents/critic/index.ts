import { z } from "zod";
import type { AgentTask } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { TaskContext, TaskResult } from "../../tasks/registry";
import { appModelSchema } from "../../schema/app-model";
import { reviewModel } from "./review-model";

const reviewModelPayloadSchema = z.object({
  appModelId: z.string(),
});

/**
 * review_model task: Critic reviews a DRAFT app model, writes a Critique row,
 * and advances the model to IN_REVIEW so the Confirmation Gate can show it.
 */
export async function handleReviewModel(
  task: AgentTask,
  ctx: TaskContext
): Promise<TaskResult> {
  const { appModelId } = reviewModelPayloadSchema.parse(task.payload);
  const { prisma } = ctx;

  const appModel = await prisma.appModel.findUnique({ where: { id: appModelId } });
  if (!appModel) {
    throw new Error(`review_model: AppModel ${appModelId} not found`);
  }

  const model = appModelSchema.parse(appModel.model);
  const { review, costUsd } = await reviewModel(model);

  const iteration = await prisma.critique.count({
    where: { targetType: "app_model", targetId: appModelId },
  });

  await prisma.critique.create({
    data: {
      projectId: appModel.projectId,
      targetType: "app_model",
      targetId: appModelId,
      verdict: review.verdict,
      findings: review.findings as unknown as Prisma.InputJsonValue,
      iteration: iteration + 1,
    },
  });

  // rejected → stay DRAFT for re-mine; otherwise open for human review.
  const nextStatus = review.verdict === "rejected" ? "DRAFT" : "IN_REVIEW";
  await prisma.appModel.update({
    where: { id: appModelId },
    data: { status: nextStatus },
  });

  return {
    verdict: review.verdict,
    findingCount: review.findings.length,
    status: nextStatus,
    costUsd,
  };
}
