"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getPilotProjects } from "../app-model/actions";
import {
  approveTestCase,
  bulkApproveTestCases,
  getTestCaseQueue,
  rejectTestCase,
  runStrategist,
  unquarantineTestCase,
  type QueueResult,
} from "./actions";
import { CaseCard } from "./components/case-row";

interface Project {
  id: string;
  name: string;
  platform: string;
}

export default function TestCasesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [queue, setQueue] = useState<QueueResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPilotProjects().then((p) => {
      setProjects(p);
      if (p.length > 0) setProjectId(p[0].id);
    });
  }, []);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setQueue(await getTestCaseQueue(projectId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load queue");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onMutate = useCallback(
    async (fn: () => Promise<unknown>, message?: string) => {
      setBusy(true);
      try {
        await fn();
        if (message) toast.success(message);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const reviewCount = queue?.review.reduce((n, g) => n + g.cases.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Test Cases</h1>
          <p className="text-sm text-muted-foreground">
            Review agent-generated tests before they go ACTIVE. {queue?.activeCount ?? 0} active ·{" "}
            {reviewCount} awaiting review.
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

      {queue && !queue.hasConfirmedModel && (
        <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
          No CONFIRMED app model yet — confirm the model in{" "}
          <span className="text-foreground">Intelligence → App Model</span> before generating tests.
        </div>
      )}

      {queue?.hasConfirmedModel && reviewCount === 0 && queue.needsHuman.length === 0 && (
        <div className="glass rounded-2xl p-5 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-muted-foreground">
            No cases awaiting review. Generate a suite from the confirmed model.
          </p>
          <button
            onClick={() =>
              onMutate(() => runStrategist(projectId), "Strategist enqueued — tests will follow")
            }
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold rounded-xl brand-gradient text-black disabled:opacity-50"
          >
            Plan &amp; generate tests
          </button>
        </div>
      )}

      {queue?.review.map((group) => (
        <div key={group.suite} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">
              {group.suite}{" "}
              <span className="text-xs text-muted-foreground">({group.cases.length})</span>
            </h2>
            <button
              onClick={() =>
                onMutate(
                  () => bulkApproveTestCases(group.cases.map((c) => c.id)),
                  `Approved ${group.cases.length} case(s)`
                )
              }
              disabled={busy}
              className="text-xs px-3 py-1 rounded-lg border border-border hover:bg-card disabled:opacity-50"
            >
              Approve all
            </button>
          </div>
          <div className="grid gap-2">
            {group.cases.map((c) => (
              <CaseCard
                key={c.id}
                testCase={c}
                isOpen={expanded === c.id}
                busy={busy}
                onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                onApprove={() => onMutate(() => approveTestCase(c.id), "Case activated")}
                onReject={(mode) =>
                  onMutate(
                    () => rejectTestCase(c.id, mode),
                    mode === "retire" ? "Retired" : "Regeneration enqueued"
                  )
                }
              />
            ))}
          </div>
        </div>
      ))}

      {queue && queue.needsHuman.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-yellow-400">
            Needs human · {queue.needsHuman.length}
          </h2>
          <p className="text-xs text-muted-foreground">
            The Critic rejected these 3× or flagged them for product judgment. Approve individually
            after review.
          </p>
          <div className="grid gap-2">
            {queue.needsHuman.map((c) => (
              <CaseCard
                key={c.id}
                testCase={c}
                isOpen={expanded === c.id}
                busy={busy}
                onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                onApprove={() => onMutate(() => approveTestCase(c.id), "Case activated")}
                onReject={(mode) =>
                  onMutate(
                    () => rejectTestCase(c.id, mode),
                    mode === "retire" ? "Retired" : "Regeneration enqueued"
                  )
                }
              />
            ))}
          </div>
        </div>
      )}

      {queue && queue.quarantined.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-red-400">Quarantined · {queue.quarantined.length}</h2>
          <p className="text-xs text-muted-foreground">
            Flaky cases the Analyst pulled from pass/fail math. Fix and unquarantine when stable.
          </p>
          <div className="grid gap-2">
            {queue.quarantined.map((c) => (
              <CaseCard
                key={c.id}
                testCase={c}
                isOpen={expanded === c.id}
                busy={busy}
                onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                onApprove={() => {}}
                onReject={() => {}}
                onUnquarantine={() =>
                  onMutate(() => unquarantineTestCase(c.id), "Case reactivated")
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
