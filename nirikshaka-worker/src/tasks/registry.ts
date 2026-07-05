import type { PrismaClient, AgentTask } from "@prisma/client";
import type { WorkerConfig } from "../config";
import type { RealtimePublisher } from "../realtime";
import type { Queryable } from "../agents/scout/types";
import { handleFuseModel } from "../agents/scout";
import { handleReviewModel } from "../agents/critic";
import { handleReviewRun } from "../agents/critic/truth-check";
import { handleExecuteRun } from "../agents/runner";
import { handlePlanStrategy } from "../agents/strategist";
import { handleGenerateTests } from "../agents/author";
import { handleReviewTests } from "../agents/critic/review-tests-handler";
import { handleAnalyzeRun } from "../agents/analyst";

export interface TaskContext {
  prisma: PrismaClient;
  config: WorkerConfig;
  realtime: RealtimePublisher;
  sql: Queryable; // raw-SQL surface for miners
}

export type TaskResult = Record<string, unknown>;

export type TaskHandler = (task: AgentTask, ctx: TaskContext) => Promise<TaskResult>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Task type → handler. Phase 0 ships only `noop` (Gate 0 plumbing check);
 * agent handlers (mine_telemetry, execute_run, ...) land in Phases 1–4.
 */
export const registry: Record<string, TaskHandler> = {
  noop: async (task) => {
    const payload = (task.payload ?? {}) as { delayMs?: number };
    const delayMs = typeof payload.delayMs === "number" ? payload.delayMs : 100;
    await sleep(Math.min(delayMs, 10_000));
    return { ok: true, echo: task.payload };
  },
  fuse_model: handleFuseModel,
  review_model: handleReviewModel,
  execute_run: handleExecuteRun,
  review_run: handleReviewRun,
  plan_strategy: handlePlanStrategy,
  generate_tests: handleGenerateTests,
  review_tests: handleReviewTests,
  analyze_run: handleAnalyzeRun,
};

export function claimableTypes(): string[] {
  return Object.keys(registry);
}
