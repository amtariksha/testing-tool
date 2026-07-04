import { z } from "zod";
import type { AgentTask, Prisma, PrismaClient } from "@prisma/client";
import type { TaskContext, TaskResult } from "../../tasks/registry";
import { appModelSchema, type AppModelDoc } from "../../schema/app-model";
import { testStrategySchema } from "../../schema/strategy";
import { hashYaml, type TestCaseDoc } from "../../schema/test-yaml";
import { assertConfirmedModel } from "../guards";
import { convertCase, generateCase, type GeneratedCase } from "./generate";
import { GenerationFailedError } from "./validate";

const findingSchema = z.object({
  severity: z.string(),
  claim: z.string(),
  detail: z.string(),
  suggestedFix: z.string().optional(),
});

const generateTestsPayloadSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("strategy"),
    strategyId: z.string(),
    featureIds: z.array(z.string()).optional(),
  }),
  z.object({
    mode: z.literal("regenerate"),
    strategyId: z.string().optional(),
    cases: z.array(
      z.object({
        caseId: z.string(),
        externalId: z.string(),
        findings: z.array(findingSchema).default([]),
      })
    ),
  }),
  z.object({
    mode: z.literal("convert"),
    suite: z.string(),
    cases: z.array(
      z.object({
        externalId: z.string(),
        title: z.string(),
        steps: z.array(z.string()),
        expected: z.array(z.string()).default([]),
      })
    ),
  }),
]);

/**
 * generate_tests task (doc §7 Phase 3). Write matrix: Author upserts
 * TestCase rows ALWAYS with needsReview:true + status DRAFT — activation is
 * a human decision. Idempotent via upsert on (projectId, externalId); a
 * cost-capped or crashed task re-runs cheaply because unchanged cases
 * overwrite identically. Chains review_tests per batch.
 */
export async function handleGenerateTests(
  task: AgentTask,
  ctx: TaskContext
): Promise<TaskResult> {
  const { prisma, config } = ctx;
  const projectId = task.projectId;
  if (!projectId) throw new Error("generate_tests: task.projectId is required");

  const payload = generateTestsPayloadSchema.parse(task.payload);
  const latestConfirmed = await assertConfirmedModel(prisma, projectId);
  const model = appModelSchema.parse(latestConfirmed.model);
  const maxRetries = config.AUTHOR_VALIDATION_RETRIES;
  const maxCost = config.AUTHOR_MAX_COST_USD;

  let costUsd = 0;
  const written: string[] = []; // TestCase ids
  const failures: string[] = [];

  const persist = async (generated: GeneratedCase, generatedFrom: unknown[]) => {
    const row = await upsertCase(prisma, projectId, generated, generatedFrom);
    written.push(row.id);
    costUsd += generated.costUsd;
    await touchLease(prisma, task.id);
  };

  if (payload.mode === "strategy") {
    const strategyRow = await prisma.testStrategy.findUnique({
      where: { id: payload.strategyId },
    });
    if (!strategyRow) throw new Error(`strategy ${payload.strategyId} not found`);
    // Strategy/model skew guard: never generate from a superseded understanding.
    if (strategyRow.appModelId !== latestConfirmed.id) {
      throw new Error(
        "generate_tests: strategy was planned against a superseded model — re-run plan_strategy"
      );
    }
    const strategy = testStrategySchema.parse(strategyRow.strategy);
    const entries = strategy.coverage.filter(
      (c) =>
        !c.skipAgent &&
        (!payload.featureIds || payload.featureIds.includes(c.featureId))
    );

    outer: for (const entry of entries) {
      const feature = model.features.find((f) => f.id === entry.featureId);
      if (!feature) continue;
      const suite =
        strategy.suites.find((s) => s.featureIds.includes(entry.featureId))?.id ??
        entry.featureId;
      for (let n = 1; n <= entry.caseBudget; n++) {
        if (costUsd >= maxCost) break outer;
        const flowId = entry.flowIds[(n - 1) % Math.max(entry.flowIds.length, 1)];
        const flow = model.flows.find((f) => f.id === flowId) ?? null;
        const externalId = `${entry.featureId}--${flow?.id ?? "case"}--${n}`;
        try {
          const generated = await generateCase(
            model,
            { externalId, suite, feature, flow, coverage: entry, caseNumber: n },
            maxRetries
          );
          await persist(generated, [
            `strategy:${strategyRow.id}`,
            `model:${latestConfirmed.id}`,
            ...(flow ? [`flow:${flow.id}`] : []),
          ]);
        } catch (error: unknown) {
          costUsd += error instanceof GenerationFailedError ? error.costUsd : 0;
          failures.push(`${externalId}: ${error instanceof Error ? error.message : error}`);
        }
      }
    }
    await enqueueReviews(prisma, projectId, written, config.REVIEW_TESTS_BATCH_SIZE, strategyRow.id);
    if (costUsd >= maxCost) {
      throw new Error(
        `generate_tests: cost cap $${maxCost} hit after ${written.length} case(s) — ` +
          `written cases are queued for review; re-enqueue to continue`
      );
    }
  } else if (payload.mode === "regenerate") {
    for (const item of payload.cases) {
      if (costUsd >= maxCost) break;
      const existing = await prisma.testCase.findUnique({ where: { id: item.caseId } });
      if (!existing) continue;
      const feature =
        model.features.find((f) => existing.tags.includes(`feature:${f.id}`)) ??
        model.features[0];
      if (!feature) continue;
      try {
        const generated = await generateCase(
          model,
          {
            externalId: item.externalId,
            suite: existing.suite,
            feature,
            flow: null,
            coverage: { featureId: feature.id, priority: "P1", flowIds: [], caseBudget: 1, skipAgent: false },
            caseNumber: 1,
            priorFindings: item.findings,
          },
          maxRetries,
          "regenerate"
        );
        await persist(generated, [
          ...(payload.strategyId ? [`strategy:${payload.strategyId}`] : []),
          `model:${latestConfirmed.id}`,
          "regenerated",
        ]);
      } catch (error: unknown) {
        failures.push(`${item.externalId}: ${error instanceof Error ? error.message : error}`);
      }
    }
    await enqueueReviews(prisma, projectId, written, config.REVIEW_TESTS_BATCH_SIZE, payload.strategyId);
  } else {
    // convert mode
    for (const manual of payload.cases) {
      if (costUsd >= maxCost) break;
      try {
        const generated = await convertCase({ ...manual, suite: payload.suite }, maxRetries);
        await persist(generated, [`md:${manual.externalId}`]);
      } catch (error: unknown) {
        failures.push(`${manual.externalId}: ${error instanceof Error ? error.message : error}`);
      }
    }
    await enqueueReviews(prisma, projectId, written, config.REVIEW_TESTS_BATCH_SIZE);
  }

  return {
    mode: payload.mode,
    written: written.length,
    failed: failures.length,
    failures: failures.slice(0, 10),
    costUsd,
  };
}

async function upsertCase(
  prisma: PrismaClient,
  projectId: string,
  generated: { doc: TestCaseDoc; yamlText: string },
  generatedFrom: unknown[]
) {
  const { doc, yamlText } = generated;
  return prisma.testCase.upsert({
    where: { projectId_externalId: { projectId, externalId: doc.id } },
    create: {
      projectId,
      externalId: doc.id,
      name: doc.name,
      suite: doc.suite,
      platform: doc.platform,
      yaml: yamlText,
      yamlHash: hashYaml(yamlText),
      tags: doc.tags,
      needsReview: true, // write matrix: Author can never activate
      status: "DRAFT",
      confidence: doc.confidence ?? "medium",
      generatedFrom: generatedFrom as Prisma.InputJsonValue,
    },
    update: {
      name: doc.name,
      suite: doc.suite,
      yaml: yamlText,
      yamlHash: hashYaml(yamlText),
      tags: doc.tags,
      needsReview: true,
      status: "DRAFT",
      generatedFrom: generatedFrom as Prisma.InputJsonValue,
    },
  });
}

async function enqueueReviews(
  prisma: PrismaClient,
  projectId: string,
  caseIds: string[],
  batchSize: number,
  strategyId?: string
): Promise<void> {
  for (let i = 0; i < caseIds.length; i += batchSize) {
    await prisma.agentTask.create({
      data: {
        type: "review_tests",
        projectId,
        payload: {
          caseIds: caseIds.slice(i, i + batchSize),
          ...(strategyId ? { strategyId } : {}),
        } as Prisma.InputJsonValue,
      },
    });
  }
}

async function touchLease(prisma: PrismaClient, taskId: string): Promise<void> {
  await prisma.agentTask
    .update({ where: { id: taskId }, data: { claimedAt: new Date() } })
    .catch(() => {});
}
