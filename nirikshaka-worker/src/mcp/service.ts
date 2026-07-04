import type { PrismaClient, Prisma } from "@prisma/client";
import type { WorkerConfig } from "../config";
import type { Queryable } from "../agents/scout/types";
import { find5xx, findCrashes, findUiErrors } from "../agents/critic/telemetry-queries";

/**
 * MCP tool implementations (doc §6) — plain functions, no MCP types, so the
 * logic is reusable and the transport layer stays thin. The MCP process only
 * READS shared state and inserts agent_tasks rows; the worker executes.
 */

export interface McpDeps {
  prisma: PrismaClient;
  sql: Queryable;
  config: WorkerConfig;
}

const POLL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

async function resolveProject(deps: McpDeps, ref: string) {
  const byId = await deps.prisma.project.findUnique({ where: { id: ref } });
  if (byId) return byId;
  const byName = await deps.prisma.project.findFirst({
    where: { name: { equals: ref, mode: "insensitive" } },
  });
  if (!byName) throw new Error(`project "${ref}" not found (use the project id or exact name)`);
  return byName;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runValidate(
  deps: McpDeps,
  input: {
    project: string;
    url?: string;
    flow?: string;
    gitSha?: string;
    data?: Record<string, string>;
    max_cost_usd?: number;
    timeout_ms?: number;
  }
) {
  const project = await resolveProject(deps, input.project);

  // baseUrl: explicit param, else reuse the last run's target.
  let baseUrl = input.url;
  if (!baseUrl) {
    const lastRun = await deps.prisma.testRun.findFirst({
      where: { projectId: project.id },
      orderBy: { startedAt: "desc" },
      select: { report: true },
    });
    baseUrl = ((lastRun?.report ?? {}) as { baseUrl?: string }).baseUrl;
  }
  if (!baseUrl) {
    throw new Error("no url provided and no prior run to reuse — pass url");
  }

  // flow → suite/tag mapping: a matching suite wins, else treated as a tag;
  // no flow → the smoke suite, else the whole project.
  let scope: "suite" | "tag" | "project" = "project";
  let scopeRef: string | undefined;
  if (input.flow) {
    const suiteMatch = await deps.prisma.testCase.findFirst({
      where: { projectId: project.id, suite: input.flow, status: "ACTIVE" },
    });
    scope = suiteMatch ? "suite" : "tag";
    scopeRef = input.flow;
  } else {
    const smoke = await deps.prisma.testCase.findFirst({
      where: { projectId: project.id, suite: "smoke", status: "ACTIVE" },
    });
    if (smoke) {
      scope = "suite";
      scopeRef = "smoke";
    }
  }

  const task = await deps.prisma.agentTask.create({
    data: {
      type: "execute_run",
      projectId: project.id,
      payload: {
        scope,
        ...(scopeRef ? { scopeRef } : {}),
        baseUrl,
        trigger: "mcp",
        ...(input.gitSha ? { gitSha: input.gitSha } : {}),
        ...(input.data ? { data: input.data } : {}),
        ...(input.max_cost_usd ? { maxCostUsd: input.max_cost_usd } : {}),
      } as Prisma.InputJsonValue,
    },
  });

  const deadline = Date.now() + (input.timeout_ms ?? DEFAULT_TIMEOUT_MS);
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const taskRow = await deps.prisma.agentTask.findUnique({ where: { id: task.id } });
    if (taskRow?.status === "failed") {
      throw new Error(`run failed before executing: ${taskRow.error ?? "unknown error"}`);
    }
    const run = await deps.prisma.testRun.findFirst({
      where: { report: { path: ["taskId"], equals: task.id } },
    });
    if (!run) continue;
    const report = (run.report ?? {}) as {
      verdict?: string;
      totals?: Record<string, number>;
      cases?: Array<{ externalId: string; status: string; verdict: string | null }>;
    };
    // done once the truth check has stamped a verdict
    if (["passed", "failed", "error"].includes(run.status) && report.verdict) {
      const findings = (report.cases ?? [])
        .filter((c) => c.status === "failed" || c.verdict === "AMBER")
        .slice(0, 5);
      return {
        status: "completed",
        runId: run.id,
        verdict: report.verdict,
        totals: report.totals ?? {},
        costUsd: Number(run.costUsd ?? 0),
        topFindings: findings,
      };
    }
  }
  return {
    status: "still_running",
    taskId: task.id,
    note: "run not finished within timeout — check /dashboard/test-runs or poll again",
  };
}

export async function checkBackend(
  deps: McpDeps,
  input: { project: string; since_minutes?: number }
) {
  const project = await resolveProject(deps, input.project);
  const sinceMinutes = input.since_minutes ?? 15;
  const to = new Date();
  const from = new Date(to.getTime() - sinceMinutes * 60_000);

  const [http5xx, crashes, uiErrors] = await Promise.all([
    find5xx(deps.sql, project.id, from, to),
    findCrashes(deps.sql, project.id, from, to),
    findUiErrors(deps.sql, project.id, from, to),
  ]);

  const clean = http5xx.length === 0 && crashes.length === 0 && uiErrors.length === 0;
  return {
    project: project.name,
    windowMinutes: sinceMinutes,
    verdict: clean ? "GREEN" : "AMBER",
    http5xx: http5xx.map((r) => ({ method: r.method, path: r.path, status: r.status })),
    crashes: crashes.length,
    uiErrors: uiErrors.map((e) => ({ type: e.type, component: e.component, message: e.message })),
  };
}

export async function getAppModel(
  deps: McpDeps,
  input: { project: string; feature?: string }
) {
  const project = await resolveProject(deps, input.project);
  const model = await deps.prisma.appModel.findFirst({
    where: { projectId: project.id, status: "CONFIRMED" },
    orderBy: { version: "desc" },
  });
  if (!model) {
    throw new Error(
      `no CONFIRMED app model for "${project.name}" — the Confirmation Gate must pass first (dashboard → Intelligence → App Model)`
    );
  }
  const doc = model.model as unknown as {
    features: Array<{ id: string; name: string; confidence: number; [k: string]: unknown }>;
    flows: Array<{ id: string; featureId: string | null; [k: string]: unknown }>;
    screens: Array<{ id: string; [k: string]: unknown }>;
  };

  if (input.feature) {
    const feature = doc.features.find(
      (f) =>
        f.id === input.feature || f.name.toLowerCase() === input.feature!.toLowerCase()
    );
    if (!feature) {
      throw new Error(
        `feature "${input.feature}" not in the model — known: ${doc.features.map((f) => f.id).join(", ")}`
      );
    }
    return {
      project: project.name,
      modelVersion: model.version,
      feature,
      flows: doc.flows.filter((f) => f.featureId === feature.id),
    };
  }

  return {
    project: project.name,
    modelVersion: model.version,
    confirmedAt: model.confirmedAt,
    features: doc.features.map((f) => ({ id: f.id, name: f.name, confidence: f.confidence })),
    screens: doc.screens.length,
    flows: doc.flows.length,
  };
}
