/**
 * GATE 0 (implementation doc §7 Phase 0):
 *   1. enqueue a no-op task through the dashboard API
 *   2. worker claims it and marks it done
 *   3. realtime task events observed on the agent:tasks channel
 *   4. new APIRequest bodies are encrypted at rest (needs GATE0_TRACK_API_KEY)
 *
 * Run with the worker running (pnpm dev / systemd) and the dashboard up:
 *   pnpm gate:0
 */
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "../src/config";
import { createPrismaClient } from "../src/db/client";
import { decryptString } from "../src/crypto/envelope";
import { AGENT_CHANNEL } from "../src/realtime";

const TIMEOUT_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
  skipped?: boolean;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const results: CheckResult[] = [];
  const prisma = createPrismaClient(config.DATABASE_URL);

  const dashboardUrl = config.DASHBOARD_URL?.replace(/\/$/, "");
  if (!dashboardUrl || !config.AGENT_SHARED_SECRET) {
    throw new Error("DASHBOARD_URL and AGENT_SHARED_SECRET are required for gate:0");
  }

  // ── Realtime listener (started before enqueue so no events are missed) ──
  const seenEvents = new Set<string>();
  let realtimeReady = false;
  let supabase: ReturnType<typeof createClient> | null = null;

  if (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const channel = supabase.channel(AGENT_CHANNEL);
    channel.on("broadcast", { event: "*" }, (message) => {
      const payload = message.payload as { taskId?: string } | undefined;
      if (payload?.taskId) {
        seenEvents.add(`${message.event}:${payload.taskId}`);
      }
    });
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          realtimeReady = true;
          resolve();
        }
      });
      setTimeout(resolve, 10_000);
    });
  }

  // ── 1. Enqueue no-op via dashboard ──────────────────────────
  const enqueueRes = await fetch(`${dashboardUrl}/api/agent/enqueue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-agent-secret": config.AGENT_SHARED_SECRET,
    },
    body: JSON.stringify({ type: "noop", payload: { source: "gate0" } }),
  });
  const enqueueJson = (await enqueueRes.json()) as {
    success?: boolean;
    data?: { id?: string };
    error?: string;
  };
  const taskId = enqueueJson.data?.id;
  results.push({
    name: "enqueue via dashboard",
    ok: enqueueRes.status === 201 && Boolean(taskId),
    detail: taskId ? `task ${taskId}` : `HTTP ${enqueueRes.status}: ${enqueueJson.error ?? "?"}`,
  });

  // ── 2. Worker claims + completes ────────────────────────────
  let finalStatus = "unknown";
  if (taskId) {
    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
      const statusRes = await fetch(`${dashboardUrl}/api/agent/runs/${taskId}`, {
        headers: { "x-agent-secret": config.AGENT_SHARED_SECRET },
      });
      if (statusRes.ok) {
        const statusJson = (await statusRes.json()) as {
          data?: { status?: string };
        };
        finalStatus = statusJson.data?.status ?? "unknown";
        if (finalStatus === "done" || finalStatus === "failed") break;
      }
      await sleep(1_000);
    }
  }
  results.push({
    name: "worker claims and completes task",
    ok: finalStatus === "done",
    detail: `final status: ${finalStatus}`,
  });

  // ── 3. Realtime events observed ─────────────────────────────
  if (realtimeReady && taskId) {
    await sleep(2_000);
    const claimed = seenEvents.has(`task_claimed:${taskId}`);
    const done = seenEvents.has(`task_done:${taskId}`);
    results.push({
      name: "realtime events on agent:tasks",
      ok: claimed && done,
      detail: `task_claimed=${claimed} task_done=${done}`,
    });
  } else {
    results.push({
      name: "realtime events on agent:tasks",
      ok: false,
      skipped: true,
      detail: "SKIPPED — Supabase realtime not configured or enqueue failed",
    });
  }

  // ── 4. Encryption at rest ───────────────────────────────────
  const trackKey = process.env.GATE0_TRACK_API_KEY;
  if (trackKey) {
    const marker = `gate0-${Date.now()}`;
    const trackRes = await fetch(`${dashboardUrl}/api/track/api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": trackKey },
      body: JSON.stringify({
        method: "POST",
        path: "/nirikshaka-gate0",
        status: 200,
        duration: 1,
        requestBody: `{"marker":"${marker}"}`,
        responseBody: `{"ok":true,"marker":"${marker}"}`,
      }),
    });
    let ok = false;
    let detail = `track POST returned HTTP ${trackRes.status}`;
    if (trackRes.ok) {
      const row = await prisma.aPIRequest.findFirst({
        where: { path: "/nirikshaka-gate0" },
        orderBy: { timestamp: "desc" },
      });
      if (row?.requestBody?.startsWith("enc:v1:")) {
        const decrypted = decryptString(row.requestBody, row.projectId);
        ok = decrypted.includes(marker);
        detail = ok
          ? "body encrypted at rest, decrypts to the marker"
          : "body encrypted but decrypted content mismatch";
      } else {
        detail = "stored requestBody is NOT encrypted (missing enc:v1: prefix)";
      }
    }
    results.push({ name: "APIRequest bodies encrypted at rest", ok, detail });
  } else {
    results.push({
      name: "APIRequest bodies encrypted at rest",
      ok: false,
      skipped: true,
      detail: "SKIPPED — set GATE0_TRACK_API_KEY to run this check",
    });
  }

  // ── Summary ─────────────────────────────────────────────────
  console.log("\n═══ GATE 0 RESULTS ═══");
  for (const result of results) {
    const icon = result.skipped ? "⚠️ " : result.ok ? "✅" : "❌";
    console.log(`${icon} ${result.name} — ${result.detail}`);
  }
  const ran = results.filter((result) => !result.skipped);
  const skippedCount = results.length - ran.length;
  const pass = ran.length > 0 && ran.every((result) => result.ok);
  if (pass && skippedCount > 0) {
    console.log(
      `\nGATE 0: PASS with ${skippedCount} check(s) SKIPPED — the gate is only fully proven once every check runs`
    );
  } else {
    console.log(pass ? "\nGATE 0: PASS" : "\nGATE 0: FAIL");
  }

  if (supabase) {
    await supabase.removeAllChannels();
  }
  await prisma.$disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error("[gate0] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
