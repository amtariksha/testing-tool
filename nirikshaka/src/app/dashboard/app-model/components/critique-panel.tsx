"use client";

import { cn } from "@/lib/utils";
import { SEVERITY_STYLES, type Critique } from "../types";

export function CritiquePanel({ critique, status }: { critique: Critique; status?: string }) {
  const escalated =
    critique.verdict === "rejected" &&
    (critique.iteration ?? 1) >= 3 &&
    status === "IN_REVIEW";

  return (
    <div className="glass rounded-2xl p-5">
      {escalated && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          Critic rejected this model 3 times — human review required. Fix the source docs or
          resolve the findings below, then re-run Scout.
        </div>
      )}
      <h2 className="font-semibold mb-2">
        Critic verdict: <span className="text-brand">{critique.verdict}</span>
        {critique.iteration !== undefined && (
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            iteration {critique.iteration}/3
          </span>
        )}
      </h2>
      <ul className="space-y-2">
        {critique.findings.map((f, i) => (
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
  );
}
