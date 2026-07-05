import { z } from "zod";
import type { AgentTask, Prisma, PrismaClient } from "@prisma/client";
import type { TaskContext, TaskResult } from "../../tasks/registry";
import { appModelSchema } from "../../schema/app-model";
import { testStrategySchema, type TestStrategyDoc } from "../../schema/strategy";
import { parseTestYaml } from "../../schema/test-yaml";
import { assertConfirmedModel } from "../guards";
import { decideNextAction } from "./loop";
import { lintTestYaml, type LintFinding } from "./review-tests-lint";
import { reviewTests, type TestReview } from "./review-tests";

const reviewTestsPayloadSchema = z.object({
  caseIds: z.array(z.string()),
  strategyId: z.string().optional(),
});

type Verdict = "approved" | "rejected" | "needs_human";

/**
 * review_tests task (doc §7 Phase 3). Deterministic lint + LLM review →
 * per-case verdict; the generator-verifier loop regenerates rejected cases
 * (max iterations) then flags needs_human. Write matrix: the Critic only
 * writes Critique rows and the narrow TestCase columns confidence + tags —
 * never yaml/status/needsReview.
 */
export async function handleReviewTests(task: AgentTask, ctx: TaskContext): Promise<TaskResult> {
  const { prisma, config } = ctx;
  const projectId = task.projectId;
  if (!projectId) throw new Error("review_tests: task.projectId is required");

  const { caseIds, strategyId } = reviewTestsPayloadSchema.parse(task.payload);
  const confirmed = await assertConfirmedModel(prisma, projectId);
  const model = appModelSchema.parse(confirmed.model);

  const cases = await prisma.testCase.findMany({ where: { id: { in: caseIds } } });
  if (cases.length === 0) return { reviewed: 0 };

  let strategy: TestStrategyDoc | null = null;
  if (strategyId) {
    const row = await prisma.testStrategy.findUnique({ where: { id: strategyId } });
    if (row) strategy = testStrategySchema.parse(row.strategy);
  }

  // Deterministic lint per case (free, runs before the LLM).
  const lintByExternalId = new Map<string, LintFinding[]>();
  for (const testCase of cases) {
    try {
      lintByExternalId.set(testCase.externalId, lintTestYaml(parseTestYaml(testCase.yaml), model));
    } catch {
      lintByExternalId.set(testCase.externalId, [
        {
          severity: "critical",
          claim: `case:${testCase.externalId}`,
          detail: "YAML no longer parses",
        },
      ]);
    }
  }

  const { review, costUsd } = await reviewTests({
    cases: cases.map((c) => ({ externalId: c.externalId, yaml: c.yaml })),
    model,
    strategy,
  });
  const reviewByExternalId = new Map(review.cases.map((c) => [c.externalId, c]));

  const regenerate: Array<{ caseId: string; externalId: string; findings: unknown[] }> = [];
  const outcomes: Record<Verdict | "needs_human", number> = {
    approved: 0,
    rejected: 0,
    needs_human: 0,
  };

  for (const testCase of cases) {
    const lint = lintByExternalId.get(testCase.externalId) ?? [];
    const llm = reviewByExternalId.get(testCase.externalId);
    const findings = [...lint, ...(llm?.findings ?? [])];
    const lintCritical = lint.some((f) => f.severity === "critical");
    const verdict: Verdict = lintCritical ? "rejected" : (llm?.verdict ?? "needs_human");

    const iteration =
      (await prisma.critique.count({
        where: { targetType: "test_case", targetId: testCase.id },
      })) + 1;

    await prisma.critique.create({
      data: {
        projectId,
        targetType: "test_case",
        targetId: testCase.id,
        verdict,
        findings: findings as unknown as Prisma.InputJsonValue,
        iteration,
      },
    });

    const action = decideNextAction(verdict, iteration, config.CRITIC_TEST_MAX_ITERATIONS);
    if (action === "regenerate") {
      outcomes.rejected += 1;
      regenerate.push({ caseId: testCase.id, externalId: testCase.externalId, findings });
    } else if (action === "needs_human") {
      outcomes.needs_human += 1;
      await flagNeedsHuman(prisma, testCase.id, testCase.tags);
    } else {
      outcomes.approved += 1;
      // approved → NO TestCase write; the human bulk-approve activates it.
    }
  }

  if (regenerate.length > 0) {
    await prisma.agentTask.create({
      data: {
        type: "generate_tests",
        projectId,
        payload: {
          mode: "regenerate",
          ...(strategyId ? { strategyId } : {}),
          cases: regenerate,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return { reviewed: cases.length, ...outcomes, regenerating: regenerate.length, costUsd };
}

/** Critic's only allowed TestCase writes: confidence + the needs-human tag. */
async function flagNeedsHuman(
  prisma: PrismaClient,
  caseId: string,
  tags: string[]
): Promise<void> {
  await prisma.testCase.update({
    where: { id: caseId },
    data: {
      confidence: "low",
      tags: tags.includes("needs-human") ? tags : [...tags, "needs-human"],
    },
  });
}
