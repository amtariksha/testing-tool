import type { PrismaClient } from "@prisma/client";

export type HeartbeatStatus = "idle" | "working" | "stopped";

export interface HeartbeatHandle {
  setStatus(status: HeartbeatStatus): void;
  stop(): Promise<void>;
}

export function startHeartbeat(
  prisma: PrismaClient,
  agent: string,
  intervalMs: number
): HeartbeatHandle {
  let status: HeartbeatStatus = "idle";

  async function beat(): Promise<void> {
    try {
      await prisma.agentHeartbeat.upsert({
        where: { agent },
        create: { agent, pid: process.pid, status },
        update: { pid: process.pid, status, lastBeatAt: new Date() },
      });
    } catch (error: unknown) {
      console.error(
        "[heartbeat] beat failed:",
        error instanceof Error ? error.message : error
      );
    }
  }

  void beat();
  const timer = setInterval(() => void beat(), intervalMs);

  return {
    setStatus(next: HeartbeatStatus) {
      status = next;
    },
    async stop() {
      clearInterval(timer);
      status = "stopped";
      await beat();
    },
  };
}
