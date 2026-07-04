"use client";

import { useState } from "react";
import type { Discrepancy } from "../types";

interface DiscrepancyInboxProps {
  discrepancies: Discrepancy[];
  readOnly?: boolean;
  busy?: boolean;
  onResolve?: (index: number, resolution: string) => void;
}

/**
 * Spec-vs-telemetry conflicts demand an explicit human resolution (§4.3);
 * resolved rows collapse with the recorded decision.
 */
export function DiscrepancyInbox({
  discrepancies,
  readOnly,
  busy,
  onResolve,
}: DiscrepancyInboxProps) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  if (discrepancies.length === 0) return null;

  const open = discrepancies.filter((d) => !d.resolution).length;

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-semibold mb-2 text-yellow-400">
        Discrepancy inbox{" "}
        <span className="text-xs text-muted-foreground font-normal">({open} unresolved)</span>
      </h2>
      <ul className="space-y-3 text-sm">
        {discrepancies.map((d, i) => (
          <li key={i}>
            <p>
              <span className="text-muted-foreground">[{d.claim}]</span> spec: {d.specSays} ·{" "}
              telemetry: {d.telemetrySays}
            </p>
            {d.resolution ? (
              <p className="mt-1 text-xs text-green-400">
                ✓ resolved: {d.resolution}
                {d.resolvedBy && <span className="text-muted-foreground"> — {d.resolvedBy}</span>}
              </p>
            ) : (
              !readOnly &&
              onResolve && (
                <div className="mt-1 flex gap-2">
                  <input
                    value={drafts[i] ?? ""}
                    onChange={(e) => setDrafts({ ...drafts, [i]: e.target.value })}
                    placeholder="Resolution — e.g. 'spec is right, screen renamed in v2'…"
                    className="flex-1 bg-card border border-border rounded-lg px-3 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => {
                      const text = (drafts[i] ?? "").trim();
                      if (text) onResolve(i, text);
                    }}
                    disabled={busy || !(drafts[i] ?? "").trim()}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-card disabled:opacity-50"
                  >
                    Resolve
                  </button>
                </div>
              )
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
