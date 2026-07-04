import { loadConfig } from "./config";
import { createPrismaClient } from "./db/client";
import { createSqlPool, asQueryable } from "./db/sql";
import { createRealtimePublisher } from "./realtime";
import { startHeartbeat } from "./heartbeat";
import { startClaimLoop } from "./claimer";
import type { TaskContext } from "./tasks/registry";

const AGENT_NAME = "worker";

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = createPrismaClient(config.DATABASE_URL);

  await prisma.$queryRaw`SELECT 1`;
  console.log("[boot] database connection OK");

  const realtime = createRealtimePublisher(config);
  const sqlPool = createSqlPool(config.DATABASE_URL);
  const heartbeat = startHeartbeat(prisma, AGENT_NAME, config.HEARTBEAT_INTERVAL_MS);

  const ctx: TaskContext = { prisma, config, realtime, sql: asQueryable(sqlPool) };
  const loop = startClaimLoop(ctx, heartbeat);

  // The loop isolates task errors internally; if it still dies, exit so
  // systemd restarts a clean process instead of idling forever.
  loop.done.catch((error: unknown) => {
    console.error(
      "[boot] claim loop crashed:",
      error instanceof Error ? error.stack ?? error.message : error
    );
    process.exit(1);
  });

  let shuttingDown = false;
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[boot] ${signal} received — draining`);
    loop.stop();
    await loop.done.catch(() => {});
    await heartbeat.stop();
    await realtime.close();
    await sqlPool.end().catch(() => {});
    await prisma.$disconnect();
    console.log("[boot] shutdown complete");
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  console.log(`[boot] nirikshaka-worker running as ${config.WORKER_ID}`);
}

main().catch((error: unknown) => {
  console.error(
    "[boot] fatal:",
    error instanceof Error ? error.stack ?? error.message : error
  );
  process.exit(1);
});
