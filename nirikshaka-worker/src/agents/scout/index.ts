import { z } from "zod";
import type { AgentTask, Prisma } from "@prisma/client";
import type { TaskContext, TaskResult } from "../../tasks/registry";
import { isLlmConfigured } from "../../llm/client";
import { mineFlows } from "./flow-miner";
import { mineApiChains } from "./api-chain-miner";
import { mineSpec, type SpecSource } from "./spec-miner";
import { fuse } from "./fuse";
import { generateExplainBack, applyExplainBack } from "./explain";
import { buildAnswerDigest, buildGuidanceDigest } from "./digest";
import type { ModelFragment } from "./types";
import type { EvidenceIndex } from "../../schema/app-model";

const specSourceSchema = z.object({
  type: z.enum(["prd", "openapi"]),
  content: z.string().min(1),
});

const answerSchema = z.object({
  questionId: z.string(),
  question: z.string(),
  answer: z.string(),
  featureId: z.string().optional(),
  by: z.string().optional(),
});

const guidanceSchema = z.object({
  severity: z.string(),
  claim: z.string(),
  detail: z.string(),
  suggestedFix: z.string().optional(),
});

export const fuseModelPayloadSchema = z.object({
  sources: z.array(specSourceSchema).default([]),
  sinceDays: z.number().int().positive().optional(),
  /** Generator-verifier loop counter (gap 5); 1 = fresh human-triggered run. */
  iteration: z.number().int().min(1).default(1),
  /** Critic findings from a rejected prior version (gap 5). */
  guidance: z.array(guidanceSchema).default([]),
  /** Human answers to targeted questions (gap 4). */
  answers: z.array(answerSchema).default([]),
});

/**
 * fuse_model task (Scout orchestrator): mine telemetry + spec sources, fuse into
 * one app model, write a DRAFT AppModel row, and enqueue Critic review.
 * At-least-once safe: a retried task finds its own prior output via
 * model.meta.sourceTaskId instead of creating a duplicate version.
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

  const { sources, sinceDays, iteration, guidance, answers } =
    fuseModelPayloadSchema.parse(task.payload);

  // Idempotency guard: a crashed-then-reclaimed task must not mint another
  // version. NOTE: assumes agent_tasks rows are not pruned (true today).
  const existing = await prisma.appModel.findFirst({
    where: {
      projectId,
      model: { path: ["meta", "sourceTaskId"], equals: task.id },
    },
  });
  if (existing) {
    await enqueueReview(prisma, projectId, existing.id, sources, iteration);
    return { appModelId: existing.id, version: existing.version, resumed: true };
  }

  const fragments: ModelFragment[] = [];
  let costUsd = 0;

  // Telemetry miners (raw SQL) — empty until the app is instrumented.
  const flowOpts = sinceDays ? { sinceDays } : {};
  const [flowFrag, apiFrag] = await Promise.all([
    mineFlows(sql, projectId, flowOpts),
    mineApiChains(sql, projectId, sinceDays ? { sinceDays } : {}),
  ]);
  fragments.push(flowFrag, apiFrag);

  // Spec miner (LLM) — the primary source for the spec-first pilot. Human
  // answers and Critic findings ride along as authoritative spec addenda.
  const effectiveSources = withDigests(sources as SpecSource[], answers, guidance);
  if (effectiveSources.length > 0) {
    const { fragment, costUsd: specCost } = await mineSpec(effectiveSources);
    fragments.push(fragment);
    costUsd += specCost;
  }

  const fused = fuse(fragments);
  let model = fused.model;
  const evidence: EvidenceIndex = { ...fused.evidence };

  // Explain-back (§4.3) — non-fatal: the model is still usable without
  // summaries/questions if the LLM call fails.
  if (isLlmConfigured() && model.features.length > 0) {
    try {
      const { output, costUsd: explainCost } = await generateExplainBack(
        model,
        fused.discrepancies
      );
      model = applyExplainBack(model, output);
      costUsd += explainCost;
    } catch (error: unknown) {
      console.error(
        `[scout] explain-back failed (model stored without summaries): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  // Answers become Evidence records (§4.3), attached to the answered feature
  // when known, else keyed by question id.
  for (const answer of answers) {
    const key =
      answer.featureId && model.features.some((f) => f.id === answer.featureId)
        ? `feature:${answer.featureId}`
        : `question:${answer.questionId}`;
    evidence[key] = [
      ...(evidence[key] ?? []),
      { source: "human", ref: `question:${answer.questionId}`, confidence: 1 },
    ];
  }

  model = { ...model, meta: { sourceTaskId: task.id, iteration } };

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
      model: model as unknown as Prisma.InputJsonValue,
      evidence: evidence as unknown as Prisma.InputJsonValue,
      discrepancies: fused.discrepancies as unknown as Prisma.InputJsonValue,
    },
  });

  await enqueueReview(prisma, projectId, appModel.id, sources, iteration);

  return {
    appModelId: appModel.id,
    version,
    iteration,
    features: model.features.length,
    screens: model.screens.length,
    flows: model.flows.length,
    apiChains: model.apiChains.length,
    discrepancies: fused.discrepancies.length,
    questions: model.targeted_questions.length,
    costUsd,
  };
}

/** Append answer/guidance digests to the last PRD source (or synthesize one). */
function withDigests(
  sources: SpecSource[],
  answers: z.infer<typeof answerSchema>[],
  guidance: z.infer<typeof guidanceSchema>[]
): SpecSource[] {
  const digest = buildAnswerDigest(answers) + buildGuidanceDigest(guidance);
  if (!digest) return sources;

  const lastPrdIndex = sources.map((s) => s.type).lastIndexOf("prd");
  if (lastPrdIndex === -1) {
    return [...sources, { type: "prd", content: digest.trimStart() }];
  }
  return sources.map((source, index) =>
    index === lastPrdIndex ? { ...source, content: source.content + digest } : source
  );
}

async function enqueueReview(
  prisma: TaskContext["prisma"],
  projectId: string,
  appModelId: string,
  sources: unknown[],
  iteration: number
): Promise<void> {
  await prisma.agentTask.create({
    data: {
      type: "review_model",
      projectId,
      // sources + iteration threaded so Critic can re-enqueue fuse_model on
      // rejection (gap 5) without a schema change.
      payload: { appModelId, sources, iteration } as Prisma.InputJsonValue,
    },
  });
}
