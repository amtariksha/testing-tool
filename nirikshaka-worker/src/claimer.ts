import type { PrismaClient, AgentTask } from "@prisma/client";
import { registry, claimableTypes, type TaskContext } from "./tasks/registry";
import type { HeartbeatHandle } from "./heartbeat";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Atomically claim the oldest runnable task this worker knows how to handle.
 * FOR UPDATE SKIP LOCKED makes concurrent workers safe (doc §3 coordination).
 * Rows stuck in 'claimed' past the lease (worker crashed mid-task) become
 * claimable again — handlers must therefore be safe to re-run (at-least-once).
 */
export async function claimNextTask(
  prisma: PrismaClient,
  workerId: string,
  staleClaimSeconds: number
): Promise<AgentTask | null> {
  const types = claimableTypes();
  const rows = await prisma.$queryRaw<AgentTask[]>`
    UPDATE agent_tasks
    SET status = 'claimed', "claimedBy" = ${workerId}, "claimedAt" = now()
    WHERE id = (
      SELECT id FROM agent_tasks
      WHERE (
        status = 'queued'
        OR (status = 'claimed' AND "claimedAt" < now() - make_interval(secs => ${staleClaimSeconds}))
      )
        AND type = ANY(${types})
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *;
  `;
  return rows[0] ?? null;
}

/**
 * Finalization must never take the worker down: a transient DB error here is
 * logged and the row stays 'claimed' — the stale-claim lease re-queues it.
 */
async function finalizeTask(
  prisma: PrismaClient,
  taskId: string,
  data: { status: string; error?: string; finishedAt: Date }
): Promise<boolean> {
  try {
    await prisma.agentTask.update({ where: { id: taskId }, data });
    return true;
  } catch (error: unknown) {
    console.error(
      `[claimer] failed to finalize task ${taskId} as ${data.status}: ${errorMessage(error)}`
    );
    return false;
  }
}

async function executeTask(task: AgentTask, ctx: TaskContext): Promise<void> {
  const { prisma, config, realtime } = ctx;
  const base = {
    taskId: task.id,
    taskType: task.type,
    workerId: config.WORKER_ID,
  };

  await realtime.publish({
    ...base,
    event: "task_claimed",
    timestamp: new Date().toISOString(),
  });

  const handler = registry[task.type];
  if (!handler) {
    // claimableTypes() filters the claim query, so this only happens if the
    // registry changes between claim and dispatch.
    await finalizeTask(prisma, task.id, {
      status: "failed",
      error: `No handler for task type "${task.type}"`,
      finishedAt: new Date(),
    });
    return;
  }

  let handlerError: unknown = null;
  try {
    await handler(task, ctx);
  } catch (error: unknown) {
    handlerError = error;
  }

  if (handlerError === null) {
    const finalized = await finalizeTask(prisma, task.id, {
      status: "done",
      finishedAt: new Date(),
    });
    if (finalized) {
      await realtime.publish({
        ...base,
        event: "task_done",
        timestamp: new Date().toISOString(),
      });
      console.log(`[claimer] task ${task.id} (${task.type}) done`);
    }
  } else {
    const message = errorMessage(handlerError);
    await finalizeTask(prisma, task.id, {
      status: "failed",
      error: message,
      finishedAt: new Date(),
    });
    await realtime.publish({
      ...base,
      event: "task_failed",
      timestamp: new Date().toISOString(),
    });
    console.error(`[claimer] task ${task.id} (${task.type}) failed: ${message}`);
  }
}

export interface ClaimLoopHandle {
  stop(): void;
  done: Promise<void>;
}

export function startClaimLoop(
  ctx: TaskContext,
  heartbeat: HeartbeatHandle
): ClaimLoopHandle {
  let running = true;

  const done = (async () => {
    console.log(
      `[claimer] polling every ${ctx.config.POLL_INTERVAL_MS}ms as ${ctx.config.WORKER_ID} (types: ${claimableTypes().join(", ")})`
    );
    while (running) {
      let task: AgentTask | null = null;
      try {
        task = await claimNextTask(
          ctx.prisma,
          ctx.config.WORKER_ID,
          ctx.config.STALE_CLAIM_SECONDS
        );
      } catch (error: unknown) {
        console.error(`[claimer] claim query failed: ${errorMessage(error)}`);
      }

      if (task) {
        heartbeat.setStatus("working");
        try {
          await executeTask(task, ctx);
        } catch (error: unknown) {
          // executeTask isolates its own failures; this is a last-resort net
          // so one broken task can never take the loop down.
          console.error(
            `[claimer] unexpected error executing task ${task.id}: ${errorMessage(error)}`
          );
        } finally {
          heartbeat.setStatus("idle");
        }
      } else {
        await sleep(ctx.config.POLL_INTERVAL_MS);
      }
    }
  })();

  return {
    stop() {
      running = false;
    },
    done,
  };
}
