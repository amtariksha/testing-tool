"use client";

import { cn } from "@/lib/utils";
import { SEVERITY_STYLES, type Critique } from "../types";

export function CritiquePanel({ critique }: { critique: Critique }) {
  return (
    <div className="glass rounded-2xl p-5">
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
