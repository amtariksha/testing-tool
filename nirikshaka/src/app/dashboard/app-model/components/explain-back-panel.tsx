"use client";

import type { Feature } from "../types";

interface ExplainBackPanelProps {
  features: Feature[];
  readOnly?: boolean;
  onSummaryWrong?: (featureId: string) => void;
}

/**
 * Scout's "explain it back" (§4.3): the cheapest human check — if a summary
 * reads wrong, the model is wrong, so the shortcut rejects that feature.
 */
export function ExplainBackPanel({ features, readOnly, onSummaryWrong }: ExplainBackPanelProps) {
  const withSummary = features.filter((f) => f.summary);
  if (withSummary.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-semibold mb-1">Explain it back</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Scout&apos;s own words. If a summary is wrong, the model is wrong — reject the feature and
        re-mine.
      </p>
      <div className="space-y-3">
        {withSummary.map((f) => (
          <div key={f.id} className="border-l-2 border-brand/40 pl-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{f.name}</span>
              {!readOnly && onSummaryWrong && f.review?.decision !== "rejected" && (
                <button
                  onClick={() => onSummaryWrong(f.id)}
                  className="text-xs text-red-400 hover:underline shrink-0"
                >
                  Summary is wrong
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-line mt-1">{f.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
