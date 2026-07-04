"use client";

import { cn } from "@/lib/utils";
import { confidenceColor, type EvidenceRef, type Feature } from "../types";

interface FeatureCardProps {
  feature: Feature;
  evidence: EvidenceRef[];
  isOpen: boolean;
  onToggle: () => void;
}

export function FeatureCard({ feature, evidence, isOpen, onToggle }: FeatureCardProps) {
  return (
    <div className="glass rounded-2xl p-4">
      <button
        onClick={onToggle}
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
                    • {r.rule} <span className="text-muted-foreground">({r.source})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Evidence:</span>{" "}
            {evidence.length === 0 ? (
              <span className="text-xs text-muted-foreground">none</span>
            ) : (
              evidence.map((ev, i) => (
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
}

function DetailRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div>
      <span className="text-muted-foreground">{label}:</span> {values.join(", ")}
    </div>
  );
}
