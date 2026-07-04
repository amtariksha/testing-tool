"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { getPilotProjects } from "../app-model/actions";
import {
  enqueueTestRun,
  getSuitesAndTags,
  getTestRuns,
  type TestRunRow,
} from "./actions";
import { VerdictBadge } from "./verdict-badge";

interface Project {
  id: string;
  name: string;
  platform: string;
}

export default function TestRunsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [runs, setRuns] = useState<TestRunRow[]>([]);
  const [suites, setSuites] = useState<string[]>([]);
  const [activeCases, setActiveCases] = useState(0);
  const [busy, setBusy] = useState(false);
  // trigger panel state
  const [suite, setSuite] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [dataText, setDataText] = useState("");
  const [maxCost, setMaxCost] = useState("1");

  useEffect(() => {
    getPilotProjects().then((p) => {
      setProjects(p);
      if (p.length > 0) setProjectId(p[0].id);
    });
  }, []);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const [runList, suiteInfo] = await Promise.all([
        getTestRuns(projectId),
        getSuitesAndTags(projectId),
      ]);
      setRuns(runList);
      setSuites(suiteInfo.suites);
      setActiveCases(suiteInfo.activeCases);
      if (!suite && suiteInfo.suites.length > 0) setSuite(suiteInfo.suites[0]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load runs");
    }
  }, [projectId, suite]);

  useEffect(() => {
    void load();
  }, [load]);

  // Light refresh while anything is queued/running.
  useEffect(() => {
    const anyLive = runs.some((r) => r.status === "running" || r.status === "queued");
    if (!anyLive) return;
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [runs, load]);

  const handleRun = async () => {
    setBusy(true);
    try {
      const data: Record<string, string> = {};
      for (const line of dataText.split("\n")) {
        const eq = line.indexOf("=");
        if (eq > 0) data[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
      }
      const res = await enqueueTestRun({
        projectId,
        scope: suite ? "suite" : "project",
        scopeRef: suite || undefined,
        baseUrl,
        data,
        maxCostUsd: Number(maxCost) || undefined,
      });
      toast.success(`Run enqueued (task ${res.taskId.slice(0, 8)}…)`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to enqueue run");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Test Runs</h1>
          <p className="text-sm text-muted-foreground">
            Execute the suite and read the tri-state verdicts — AMBER means the UI passed but
            the backend didn&apos;t.
          </p>
        </div>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.platform})
            </option>
          ))}
        </select>
      </div>

      <div className="glass rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold">Run tests</h2>
        {activeCases === 0 ? (
          <p className="text-sm text-muted-foreground">
            No ACTIVE test cases for this project yet — seed the smoke suite
            (worker: <code className="text-xs">pnpm seed:smoke --project {projectId || "<id>"}</code>)
            or generate cases in Phase 3.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs text-muted-foreground">
              Suite ({activeCases} active cases)
              <select
                value={suite}
                onChange={(e) => setSuite(e.target.value)}
                className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                <option value="">All active cases</option>
                {suites.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Base URL (staging deployment)
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://staging.example.com"
                className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Data overrides (KEY=value per line)
              <textarea
                value={dataText}
                onChange={(e) => setDataText(e.target.value)}
                placeholder={"admin_phone=+91…\nadmin_otp=123456"}
                className="mt-1 w-full h-[38px] min-h-[38px] bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground"
              />
            </label>
            <div className="flex items-end gap-2">
              <label className="text-xs text-muted-foreground flex-1">
                Cost cap $
                <input
                  value={maxCost}
                  onChange={(e) => setMaxCost(e.target.value)}
                  className="mt-1 w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </label>
              <button
                onClick={handleRun}
                disabled={busy || !baseUrl.trim()}
                className="px-4 py-2 text-sm font-semibold rounded-xl brand-gradient text-black hover:opacity-90 disabled:opacity-50"
              >
                Run
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground border-b border-border">
              <th className="px-4 py-3">Verdict</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Results</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Trigger</th>
              <th className="px-4 py-3">Started</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No runs yet.
                </td>
              </tr>
            )}
            {runs.map((run) => (
              <tr key={run.id} className="border-b border-border/50 hover:bg-card/50">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/test-runs/${run.id}`}>
                    <VerdictBadge verdict={run.verdict} />
                  </Link>
                </td>
                <td className="px-4 py-3">{run.status}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {run.scope}
                  {run.scopeRef ? `: ${run.scopeRef}` : ""}
                </td>
                <td className="px-4 py-3">
                  {run.totals
                    ? `${run.totals.passed ?? 0}✓ ${run.totals.failed ?? 0}✗ ${
                        run.totals.amber ?? 0
                      }⚠ ${run.totals.skipped ?? 0}−`
                    : "—"}
                </td>
                <td className="px-4 py-3">${run.costUsd.toFixed(4)}</td>
                <td className="px-4 py-3 text-muted-foreground">{run.trigger}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  <Link href={`/dashboard/test-runs/${run.id}`} className="hover:underline">
                    {run.startedAt ? new Date(run.startedAt).toLocaleString() : "—"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
