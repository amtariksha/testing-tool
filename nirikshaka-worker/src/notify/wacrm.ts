import type { WorkerConfig } from "../config";

/**
 * WhatsApp notification via the WACRM webhook (doc §5.5): fires when a run
 * finishes with failures or any AMBER verdict. Payload is a generic JSON
 * envelope with a WhatsApp-ready `message` string — the WACRM side can use
 * either. Unset WACRM_WEBHOOK_URL → log and skip; a notify failure must
 * never fail the review_run task.
 */

export interface RunNotificationInput {
  runId: string;
  projectId: string;
  projectName: string;
  verdict: string;
  totals: { total: number; passed: number; failed: number; skipped: number; amber: number };
  costUsd: number;
  scope: string;
  scopeRef?: string | null;
  topFindings: string[]; // e.g. "smoke-login — expect_visible 'Dashboard' timed out"
  dashboardUrl?: string;
}

export interface WacrmPayload {
  source: "nirikshaka";
  event: "test_run_finished";
  runId: string;
  projectId: string;
  projectName: string;
  verdict: string;
  totals: RunNotificationInput["totals"];
  costUsd: number;
  link: string | null;
  message: string;
}

/** Pure payload builder — unit-tested. */
export function buildRunNotification(input: RunNotificationInput): WacrmPayload {
  const link = input.dashboardUrl
    ? `${input.dashboardUrl.replace(/\/$/, "")}/dashboard/test-runs/${input.runId}`
    : null;
  const scopeLabel = input.scopeRef ? `${input.scope}: ${input.scopeRef}` : input.scope;
  const findings = input.topFindings.slice(0, 2).join(" · ");
  const message =
    `Nirikshaka ${input.verdict}: ${input.totals.failed}/${input.totals.total} failed, ` +
    `${input.totals.amber} amber on ${input.projectName} (${scopeLabel}).` +
    (findings ? ` Top: ${findings}.` : "") +
    ` Cost $${input.costUsd.toFixed(2)}.` +
    (link ? ` Details: ${link}` : "");

  return {
    source: "nirikshaka",
    event: "test_run_finished",
    runId: input.runId,
    projectId: input.projectId,
    projectName: input.projectName,
    verdict: input.verdict,
    totals: input.totals,
    costUsd: input.costUsd,
    link,
    message,
  };
}

/** True when the run warrants a ping (doc §5.5: failed>0 or any AMBER). */
export function shouldNotify(totals: { failed: number; amber: number }): boolean {
  return totals.failed > 0 || totals.amber > 0;
}

export async function sendWacrmNotification(
  config: Pick<WorkerConfig, "WACRM_WEBHOOK_URL">,
  payload: WacrmPayload
): Promise<{ sent: boolean }> {
  if (!config.WACRM_WEBHOOK_URL) {
    console.warn("[notify] WACRM_WEBHOOK_URL not set — skipping WhatsApp notification");
    return { sent: false };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(config.WACRM_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) {
      console.warn(`[notify] WACRM webhook returned ${response.status}`);
      return { sent: false };
    }
    return { sent: true };
  } catch (error: unknown) {
    console.warn(
      `[notify] WACRM webhook failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return { sent: false };
  }
}
