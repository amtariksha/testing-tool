import type { PrismaClient } from "@prisma/client";
import type { WorkerConfig } from "./config";

/**
 * Worker-internal daily scheduler (doc §7 Phase 4 — no external cron). On each
 * tick it decides whether to run the Analyst sweep and, if so, atomically
 * claims the slot via the analyst-scheduler heartbeat row and enqueues normal
 * analyze_run tasks (so the claim loop's at-least-once semantics apply).
 */

const SCHEDULER_AGENT = "analyst-scheduler";

/** Pure: run at the anchor hour, at most once per ~day. */
export function shouldRunAnalysis(
  now: Date,
  anchorHour: number,
  lastRunAt: Date | null,
  minGapHours = 20
): boolean {
  if (now.getHours() !== anchorHour) return false;
  if (!lastRunAt) return true;
  return now.getTime() - lastRunAt.getTime() >= minGapHours * 60 * 60 * 1000;
}

export interface SchedulerHandle {
  stop(): void;
}

export function startScheduler(
  prisma: PrismaClient,
  config: WorkerConfig,
  now: () => Date = () => new Date()
): SchedulerHandle {
  const tick = async (): Promise<void> => {
    try {
      const beat = await prisma.agentHeartbeat.findUnique({ where: { agent: SCHEDULER_AGENT } });
      const current = now();
      if (!shouldRunAnalysis(current, config.ANALYST_HOUR, beat?.lastBeatAt ?? null)) return;

      // Atomic slot claim: only the worker whose update matches the stale
      // window proceeds (safe if a second worker ever runs).
      const cutoff = new Date(current.getTime() - 20 * 60 * 60 * 1000);
      if (beat) {
        const claimed = await prisma.agentHeartbeat.updateMany({
          where: { agent: SCHEDULER_AGENT, lastBeatAt: { lt: cutoff } },
          data: { lastBeatAt: current },
        });
        if (claimed.count !== 1) return;
      } else {
        await prisma.agentHeartbeat.create({
          data: { agent: SCHEDULER_AGENT, status: "scheduler", lastBeatAt: current },
        });
      }

      await enqueueSweeps(prisma);
    } catch (error: unknown) {
      console.error(
        `[scheduler] tick failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };

  const timer = setInterval(() => void tick(), config.SCHEDULER_TICK_MS);
  console.log(
    `[scheduler] analyst sweep at hour ${config.ANALYST_HOUR}, checking every ${Math.round(
      config.SCHEDULER_TICK_MS / 60000
    )}min`
  );
  return { stop: () => clearInterval(timer) };
}

/** One analyze_run{sweep} per project with tests or a confirmed model. */
async function enqueueSweeps(prisma: PrismaClient): Promise<void> {
  const [withCases, withModel] = await Promise.all([
    prisma.testCase.findMany({ distinct: ["projectId"], select: { projectId: true } }),
    prisma.appModel.findMany({
      where: { status: "CONFIRMED" },
      distinct: ["projectId"],
      select: { projectId: true },
    }),
  ]);
  const projectIds = [...new Set([...withCases, ...withModel].map((r) => r.projectId))];
  for (const projectId of projectIds) {
    await prisma.agentTask.create({
      data: { type: "analyze_run", projectId, payload: { sweep: true } },
    });
  }
  console.log(`[scheduler] enqueued ${projectIds.length} analyst sweep(s)`);
}
