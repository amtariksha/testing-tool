"use client";

import React, { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  getPilotProjects,
  getLatestAppModel,
  confirmAppModel,
  rejectAppModel,
  runScout,
} from "./actions";

interface PilotProject {
  id: string;
  name: string;
  platform: string;
}

interface Feature {
  id: string;
  name: string;
  confidence: number;
  roles: string[];
  screens: string[];
  apis: string[];
  states: string[];
  business_rules: { rule: string; source: string; confidence: number }[];
}

interface AppModelDoc {
  features: Feature[];
  screens: { id: string }[];
  flows: unknown[];
  apiChains: unknown[];
  coverage_boundaries: { agent_can_test: string[]; needs_human: string[] };
}

interface EvidenceRef {
  source: string;
  ref: string;
  confidence: number;
}

interface Discrepancy {
  claim: string;
  specSays: string;
  telemetrySays: string;
}

interface Critique {
  verdict: string;
  findings: { severity: string; claim: string; detail: string; suggestedFix?: string }[];
}

interface LoadedModel {
  appModel: {
    id: string;
    version: number;
    status: string;
    model: AppModelDoc;
    evidence: Record<string, EvidenceRef[]>;
    discrepancies: Discrepancy[] | null;
    confirmedBy: string | null;
    confirmedAt: string | null;
  };
  critique: Critique | null;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-500/15 text-gray-400",
  IN_REVIEW: "bg-yellow-500/15 text-yellow-400",
  CONFIRMED: "bg-green-500/15 text-green-400",
  STALE: "bg-red-500/15 text-red-400",
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-gray-400",
};

function confidenceColor(c: number): string {
  if (c >= 0.8) return "bg-green-500";
  if (c >= 0.6) return "bg-yellow-500";
  return "bg-red-500";
}

export default function AppModelPage() {
  const [projects, setProjects] = useState<PilotProject[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [loaded, setLoaded] = useState<LoadedModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prd, setPrd] = useState("");
  const [openapi, setOpenapi] = useState("");

  useEffect(() => {
    getPilotProjects().then((p) => {
      setProjects(p);
      if (p.length > 0) setProjectId(p[0].id);
    });
  }, []);

  const load = useCallback(async (pid: string) => {
    if (!pid) return;
    setLoading(true);
    try {
      const result = await getLatestAppModel(pid);
      setLoaded(result as LoadedModel | null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load model");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (projectId) load(projectId);
  }, [projectId, load]);

  const handleConfirm = async () => {
    if (!loaded) return;
    setBusy(true);
    try {
      await confirmAppModel(loaded.appModel.id);
      toast.success("App model CONFIRMED — Strategist/Author can now use it");
      await load(projectId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!loaded) return;
    setBusy(true);
    try {
      await rejectAppModel(loaded.appModel.id);
      toast.success("Sent back to DRAFT for re-mining");
      await load(projectId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRunScout = async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      const res = await runScout(projectId, [
        { type: "prd", content: prd },
        { type: "openapi", content: openapi },
      ]);
      toast.success(`Scout enqueued (task ${res.taskId.slice(0, 8)}…) — refresh in ~30s`);
      setPrd("");
      setOpenapi("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to enqueue Scout");
    } finally {
      setBusy(false);
    }
  };

  const model = loaded?.appModel.model;
  const evidence = loaded?.appModel.evidence ?? {};
  const discrepancies = loaded?.appModel.discrepancies ?? [];
  const canConfirm =
    loaded && (loaded.appModel.status === "IN_REVIEW" || loaded.appModel.status === "DRAFT");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Confirmation Gate</h1>
          <p className="text-sm text-muted-foreground">
            Review Scout&apos;s understanding of the app before any test is generated.
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

      {loading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {!loading && !loaded && (
        <RunScoutPanel
          prd={prd}
          openapi={openapi}
          setPrd={setPrd}
          setOpenapi={setOpenapi}
          onRun={handleRunScout}
          busy={busy}
          empty
        />
      )}

      {!loading && loaded && model && (
        <>
          <div className="glass rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold",
                  STATUS_STYLES[loaded.appModel.status] ?? "bg-gray-500/15"
                )}
              >
                {loaded.appModel.status}
              </span>
              <span className="text-sm text-muted-foreground">v{loaded.appModel.version}</span>
              <span className="text-sm text-muted-foreground">
                {model.features.length} features · {model.screens.length} screens ·{" "}
                {model.flows.length} flows · {model.apiChains.length} api chains ·{" "}
                {discrepancies.length} discrepancies
              </span>
            </div>
            {canConfirm && (
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={busy}
                  className="px-4 py-2 text-sm font-medium rounded-xl border border-border hover:bg-card disabled:opacity-50"
                >
                  Reject → re-mine
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={busy}
                  className="px-4 py-2 text-sm font-semibold rounded-xl brand-gradient text-black hover:opacity-90 disabled:opacity-50"
                >
                  Confirm model
                </button>
              </div>
            )}
            {loaded.appModel.status === "CONFIRMED" && loaded.appModel.confirmedBy && (
              <span className="text-xs text-muted-foreground">
                confirmed by {loaded.appModel.confirmedBy}
              </span>
            )}
          </div>

          {loaded.critique && (
            <div className="glass rounded-2xl p-5">
              <h2 className="font-semibold mb-2">
                Critic verdict:{" "}
                <span className="text-brand">{loaded.critique.verdict}</span>
              </h2>
              <ul className="space-y-2">
                {loaded.critique.findings.map((f, i) => (
                  <li key={i} className="text-sm">
                    <span className={cn("font-semibold uppercase text-xs", SEVERITY_STYLES[f.severity])}>
                      {f.severity}
                    </span>{" "}
                    <span className="text-muted-foreground">[{f.claim}]</span> {f.detail}
                    {f.suggestedFix && (
                      <span className="block text-xs text-muted-foreground mt-0.5">
                        fix: {f.suggestedFix}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {discrepancies.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h2 className="font-semibold mb-2 text-yellow-400">Discrepancy inbox</h2>
              <ul className="space-y-2 text-sm">
                {discrepancies.map((d, i) => (
                  <li key={i}>
                    <span className="text-muted-foreground">[{d.claim}]</span> spec: {d.specSays} ·{" "}
                    telemetry: {d.telemetrySays}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3">
            {model.features.map((feature) => {
              const featureEvidence = evidence[`feature:${feature.id}`] ?? [];
              const isOpen = expanded === feature.id;
              return (
                <div key={feature.id} className="glass rounded-2xl p-4">
                  <button
                    onClick={() => setExpanded(isOpen ? null : feature.id)}
                    className="w-full flex items-center justify-between gap-4 text-left"
                  >
                    <span className="font-medium">{feature.name}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-28 h-2 rounded-full bg-border overflow-hidden">
                        <div
                          className={cn("h-full", confidenceColor(feature.confidence))}
                          style={{ width: `${Math.round(feature.confidence * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8">
                        {Math.round(feature.confidence * 100)}%
                      </span>
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mt-4 space-y-2 text-sm border-t border-border pt-3">
                      <DetailRow label="Roles" values={feature.roles} />
                      <DetailRow label="Screens" values={feature.screens} />
                      <DetailRow label="APIs" values={feature.apis} />
                      <DetailRow label="States" values={feature.states} />
                      {feature.business_rules.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Business rules:</span>
                          <ul className="mt-1 space-y-1">
                            {feature.business_rules.map((r, i) => (
                              <li key={i} className="text-xs">
                                • {r.rule}{" "}
                                <span className="text-muted-foreground">({r.source})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Evidence:</span>{" "}
                        {featureEvidence.length === 0 ? (
                          <span className="text-xs text-muted-foreground">none</span>
                        ) : (
                          featureEvidence.map((ev, i) => (
                            <span
                              key={i}
                              className="inline-block text-xs bg-card border border-border rounded px-2 py-0.5 mr-1 mb-1"
                            >
                              {ev.source}:{ev.ref} ({Math.round(ev.confidence * 100)}%)
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <RunScoutPanel
            prd={prd}
            openapi={openapi}
            setPrd={setPrd}
            setOpenapi={setOpenapi}
            onRun={handleRunScout}
            busy={busy}
          />
        </>
      )}
    </div>
  );
}

function DetailRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span> {values.join(", ")}
    </div>
  );
}

interface RunScoutPanelProps {
  prd: string;
  openapi: string;
  setPrd: (v: string) => void;
  setOpenapi: (v: string) => void;
  onRun: () => void;
  busy: boolean;
  empty?: boolean;
}

function RunScoutPanel({ prd, openapi, setPrd, setOpenapi, onRun, busy, empty }: RunScoutPanelProps) {
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <h2 className="font-semibold">
        {empty ? "No model yet — run Scout" : "Re-run Scout with updated docs"}
      </h2>
      <textarea
        value={prd}
        onChange={(e) => setPrd(e.target.value)}
        placeholder="Paste PRD / feature doc (markdown or plain text)…"
        className="w-full h-32 bg-card border border-border rounded-lg p-3 text-sm font-mono"
      />
      <textarea
        value={openapi}
        onChange={(e) => setOpenapi(e.target.value)}
        placeholder="Paste OpenAPI JSON (optional)…"
        className="w-full h-24 bg-card border border-border rounded-lg p-3 text-sm font-mono"
      />
      <button
        onClick={onRun}
        disabled={busy || (prd.trim().length === 0 && openapi.trim().length === 0)}
        className="px-4 py-2 text-sm font-semibold rounded-xl brand-gradient text-black hover:opacity-90 disabled:opacity-50"
      >
        Run Scout
      </button>
    </div>
  );
}
