"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getWorkerHealth, type WorkerHealth } from "@/app/dashboard/actions";

const POLL_MS = 30_000;

/**
 * Topbar badge for agent-worker liveness (DEVELOPER-MANUAL §8 gap 2): reads
 * agent_heartbeats via a server action. Down = heartbeat older than 30s or
 * status "stopped" — a dead worker no longer looks identical to a slow one.
 */
export function WorkerHealthBadge() {
  const [health, setHealth] = useState<WorkerHealth | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const result = await getWorkerHealth();
        if (!cancelled) setHealth(result);
      } catch {
        // unauthenticated or transient — keep last known state
      }
    };
    void check();
    const timer = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!health || health.state === "unknown") return null;

  const up = health.state === "up";
  const working = up && health.agentStatus === "working";

  return (
    <span
      className={cn(
        "hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border",
        up
          ? "border-green-500/30 bg-green-500/10 text-green-400"
          : "border-red-500/30 bg-red-500/10 text-red-400"
      )}
      title={
        health.lastBeatAt
          ? `Last heartbeat: ${new Date(health.lastBeatAt).toLocaleTimeString()}`
          : undefined
      }
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          up ? "bg-green-400" : "bg-red-400",
          working && "animate-pulse"
        )}
      />
      {up ? (working ? "Agents working" : "Agents online") : "Agents offline"}
    </span>
  );
}
