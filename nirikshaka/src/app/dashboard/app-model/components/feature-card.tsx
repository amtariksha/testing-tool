"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Pencil, Star } from "lucide-react";
import { confidenceColor, type EvidenceRef, type Feature } from "../types";

interface FeatureCardProps {
  feature: Feature;
  evidence: EvidenceRef[];
  isOpen: boolean;
  onToggle: () => void;
  readOnly?: boolean;
  onReview?: (review: { decision?: "approved" | "rejected"; criticalPath?: boolean }) => void;
  onEdit?: () => void;
}

export function FeatureCard({
  feature,
  evidence,
  isOpen,
  onToggle,
  readOnly,
  onReview,
  onEdit,
}: FeatureCardProps) {
  const review = feature.review;
  return (
    <div
      className={cn(
        "glass rounded-2xl p-4",
        review?.decision === "rejected" && "border border-red-500/40",
        review?.decision === "approved" && "border border-green-500/30"
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 text-left"
      >
        <span className="font-medium flex items-center gap-2">
          {feature.name}
          {review?.criticalPath && (
            <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" aria-label="critical path" />
          )}
          {review?.decision === "approved" && <CheckCircle2 className="h-4 w-4 text-green-400" />}
          {review?.decision === "rejected" && <XCircle className="h-4 w-4 text-red-400" />}
          {review?.edited && (
            <span className="text-[10px] uppercase text-muted-foreground border border-border rounded px-1">
              edited
            </span>
          )}
        </span>
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
          {feature.summary && (
            <p className="text-xs text-muted-foreground whitespace-pre-line border-l-2 border-brand/40 pl-2">
              {feature.summary}
            </p>
          )}
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
          {!readOnly && onReview && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <ReviewButton
                active={review?.decision === "approved"}
                activeClass="bg-green-500/15 text-green-400 border-green-500/40"
                onClick={() =>
                  onReview({ decision: review?.decision === "approved" ? undefined : "approved" })
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </ReviewButton>
              <ReviewButton
                active={review?.decision === "rejected"}
                activeClass="bg-red-500/15 text-red-400 border-red-500/40"
                onClick={() =>
                  onReview({ decision: review?.decision === "rejected" ? undefined : "rejected" })
                }
              >
                <XCircle className="h-3.5 w-3.5" /> Reject
              </ReviewButton>
              {onEdit && (
                <ReviewButton active={false} activeClass="" onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </ReviewButton>
              )}
              <ReviewButton
                active={Boolean(review?.criticalPath)}
                activeClass="bg-yellow-500/15 text-yellow-400 border-yellow-500/40"
                onClick={() => onReview({ criticalPath: !review?.criticalPath })}
              >
                <Star className="h-3.5 w-3.5" /> Critical path
              </ReviewButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewButton({
  active,
  activeClass,
  onClick,
  children,
}: {
  active: boolean;
  activeClass: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-border hover:bg-card transition-colors",
        active && activeClass
      )}
    >
      {children}
    </button>
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
