"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getTestRun, type CaseResultRow } from "../actions";
import { VerdictBadge } from "../verdict-badge";

interface StepEntry {
  index: number;
  action: string;
  target?: string;
  status: string;
  durationMs: number;
  attempts: number;
  note?: string;
}

const STEP_STYLES: Record<string, string> = {
  passed: "text-green-400",
  recovered: "text-yellow-400",
  failed: "text-red-400",
  skipped: "text-gray-400",
};

type RunDetail = Awaited<ReturnType<typeof getTestRun>>;

export default function TestRunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = use(params);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getTestRun(runId)
      .then(setDetail)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load run"));
  }, [runId]);

  if (!detail) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const { run, results } = detail;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            Run on {run.projectName} <VerdictBadge verdict={run.verdict} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {run.scope}
            {run.scopeRef ? `: ${run.scopeRef}` : ""} · {run.trigger} · {run.status}
            {run.gitSha ? ` · ${run.gitSha.slice(0, 8)}` : ""}
            {run.baseUrl ? ` · ${run.baseUrl}` : ""}
          </p>
        </div>
        <Link
          href="/dashboard/test-runs"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← All runs
        </Link>
      </div>

      <div className="glass rounded-2xl p-5 flex flex-wrap gap-6 text-sm">
        <Stat label="Cases" value={String(run.totals?.cases ?? results.length)} />
        <Stat label="Passed" value={String(run.totals?.passed ?? 0)} />
        <Stat label="Failed" value={String(run.totals?.failed ?? 0)} />
        <Stat label="Amber" value={String(run.totals?.amber ?? 0)} />
        <Stat label="Skipped" value={String(run.totals?.skipped ?? 0)} />
        <Stat label="Cost" value={`$${run.costUsd.toFixed(4)}`} />
        <Stat
          label="Duration"
          value={
            run.startedAt && run.finishedAt
              ? `${Math.round(
                  (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
                )}s`
              : "—"
          }
        />
      </div>

      <div className="grid gap-3">
        {results.map((result) => (
          <CaseCard
            key={result.id}
            result={result}
            isOpen={expanded === result.id}
            onToggle={() => setExpanded(expanded === result.id ? null : result.id)}
          />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function CaseCard({
  result,
  isOpen,
  onToggle,
}: {
  result: CaseResultRow;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const verdict = result.verdict as {
    final?: string;
    backend?: {
      http5xx?: Array<{ id: string; method: string; path: string; status: number }>;
      expectations?: Array<{
        expect: { path_contains: string; method?: string; status_lt: number };
        ok: boolean;
        matched: { status: number } | null;
      }>;
      uiErrors?: Array<{ component: string; message: string }>;
      crashes?: number;
    };
  } | null;

  return (
    <div className="glass rounded-2xl p-4">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 text-left">
        <span className="font-medium">
          {result.externalId}
          <span className="text-muted-foreground font-normal"> — {result.name}</span>
        </span>
        <span className="flex items-center gap-3 shrink-0 text-xs">
          <VerdictBadge verdict={verdict?.final ?? null} />
          <span className={cn(STEP_STYLES[result.status] ?? "text-muted-foreground")}>
            {result.status}
          </span>
          <span className="text-muted-foreground">
            {result.durationMs ? `${(result.durationMs / 1000).toFixed(1)}s` : ""}
          </span>
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-border space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            {result.usedFastPath ? "fast path (zero LLM)" : "used LLM recovery"} ·{" "}
            {result.llmCalls} LLM call(s) · ${result.llmCostUsd.toFixed(4)}
          </p>

          {result.errorMessage && (
            <p className="text-xs text-red-400 font-mono whitespace-pre-wrap">
              {result.errorMessage}
            </p>
          )}

          {verdict?.final === "AMBER" && verdict.backend && (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-yellow-400">
                Silent failure: UI passed, backend did not
              </p>
              {(verdict.backend.http5xx ?? []).map((r, i) => (
                <p key={i} className="text-xs font-mono">
                  {r.status} {r.method} {r.path}
                </p>
              ))}
              {(verdict.backend.expectations ?? [])
                .filter((e) => !e.ok)
                .map((e, i) => (
                  <p key={i} className="text-xs font-mono">
                    expected {e.expect.method ?? "any"} …{e.expect.path_contains}… &lt;{" "}
                    {e.expect.status_lt} → {e.matched ? `got ${e.matched.status}` : "no call seen"}
                  </p>
                ))}
              {(verdict.backend.uiErrors ?? []).map((e, i) => (
                <p key={i} className="text-xs font-mono">
                  ui-error {e.component}: {e.message}
                </p>
              ))}
              <Link href="/dashboard/requests" className="text-xs underline text-yellow-400">
                Inspect requests →
              </Link>
            </div>
          )}

          {(result.stepLog as StepEntry[]).length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Step log</p>
              <ol className="space-y-0.5">
                {(result.stepLog as StepEntry[]).map((step, i) => (
                  <li key={i} className="text-xs font-mono flex gap-2">
                    <span className="text-muted-foreground w-6">{step.index + 1}.</span>
                    <span className={cn("w-20", STEP_STYLES[step.status])}>{step.status}</span>
                    <span>
                      {step.action}
                      {step.target ? ` → ${step.target}` : ""}
                      {step.note ? ` (${step.note})` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {result.screenshots.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {result.screenshots.map((src, i) =>
                src.startsWith("http") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={i} href={src} target="_blank" rel="noreferrer">
                    <img
                      src={src}
                      alt={`failure screenshot ${i + 1}`}
                      className="h-32 rounded-lg border border-border object-cover"
                    />
                  </a>
                ) : (
                  <span key={i} className="text-xs text-muted-foreground font-mono">
                    {src} (on worker disk)
                  </span>
                )
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
