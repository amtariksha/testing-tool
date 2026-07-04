"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  getPilotProjects,
  getLatestAppModel,
  confirmAppModel,
  rejectAppModel,
  runScout,
} from "./actions";
import type { LoadedModel, PilotProject } from "./types";
import { useScoutPipeline } from "./use-scout-pipeline";
import { StatusHeader } from "./components/status-header";
import { TaskProgressChip } from "./components/task-progress-chip";
import { CritiquePanel } from "./components/critique-panel";
import { DiscrepancyInbox } from "./components/discrepancy-inbox";
import { FeatureCard } from "./components/feature-card";
import { RunScoutPanel } from "./components/run-scout-panel";

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

  // Pipeline poller: reload the model + toast when the queue settles (gap 1).
  const onPipelineSettled = useCallback(() => {
    void load(projectId);
    toast.info("Agent pipeline finished — model refreshed");
  }, [load, projectId]);
  const pipeline = useScoutPipeline(projectId, onPipelineSettled);

  /** Shared busy/toast/reload wrapper for every mutating action. */
  const onMutate = useCallback(
    async (fn: () => Promise<unknown>, successMessage?: string) => {
      setBusy(true);
      try {
        await fn();
        if (successMessage) toast.success(successMessage);
        await load(projectId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [load, projectId]
  );

  const handleRunScout = async () => {
    if (!projectId) return;
    setBusy(true);
    try {
      const res = await runScout(projectId, [
        { type: "prd", content: prd },
        { type: "openapi", content: openapi },
      ]);
      toast.success(`Scout enqueued (task ${res.taskId.slice(0, 8)}…)`);
      setPrd("");
      setOpenapi("");
      pipeline.notifyEnqueued();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to enqueue Scout");
    } finally {
      setBusy(false);
    }
  };

  const model = loaded?.appModel.model;
  const evidence = loaded?.appModel.evidence ?? {};
  const discrepancies = loaded?.appModel.discrepancies ?? [];
  const canConfirm = Boolean(
    loaded && (loaded.appModel.status === "IN_REVIEW" || loaded.appModel.status === "DRAFT")
  );

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
        <div className="space-y-3">
          <TaskProgressChip tasks={pipeline.tasks} />
        </div>
      )}
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
          <StatusHeader
            loaded={loaded}
            discrepancyCount={discrepancies.length}
            busy={busy}
            canConfirm={canConfirm}
            onConfirm={() =>
              onMutate(
                () => confirmAppModel(loaded.appModel.id),
                "App model CONFIRMED — Strategist/Author can now use it"
              )
            }
            onReject={() =>
              onMutate(() => rejectAppModel(loaded.appModel.id), "Sent back to DRAFT for re-mining")
            }
          >
            <TaskProgressChip tasks={pipeline.tasks} />
          </StatusHeader>

          {loaded.critique && <CritiquePanel critique={loaded.critique} />}

          <DiscrepancyInbox discrepancies={discrepancies} />

          <div className="grid gap-3">
            {model.features.map((feature) => (
              <FeatureCard
                key={feature.id}
                feature={feature}
                evidence={evidence[`feature:${feature.id}`] ?? []}
                isOpen={expanded === feature.id}
                onToggle={() => setExpanded(expanded === feature.id ? null : feature.id)}
              />
            ))}
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
