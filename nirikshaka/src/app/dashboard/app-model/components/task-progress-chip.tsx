"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ScoutTaskInfo } from "../actions";

const LABELS: Record<string, string> = {
  fuse_model: "Scout mining",
  review_model: "Critic reviewing",
};

/**
 * Renders the newest pipeline task as a status chip: progress while
 * queued/claimed, the agent_tasks.error (expandable) on failure.
 */
export function TaskProgressChip({ tasks }: { tasks: ScoutTaskInfo[] }) {
  const [showError, setShowError] = useState(false);
  const task = tasks[0];
  if (!task) return null;

  const label = LABELS[task.type] ?? task.type;
  const iteration = task.iteration > 1 ? ` (iteration ${task.iteration}/3)` : "";

  if (task.status === "queued" || task.status === "claimed") {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-brand/10 text-brand">
        <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
        {label}…{iteration} {task.status === "queued" ? "(queued)" : ""}
      </span>
    );
  }

  if (task.status === "failed") {
    return (
      <button
        onClick={() => setShowError(!showError)}
        className="inline-flex flex-col items-start px-3 py-1 rounded-lg text-xs bg-red-500/10 text-red-400 text-left max-w-md"
        title="Click to toggle error details"
      >
        <span className="font-semibold">
          {label} failed{iteration} — click for details
        </span>
        {showError && (
          <span className={cn("mt-1 font-mono whitespace-pre-wrap break-all")}>
            {task.error ?? "no error recorded"}
          </span>
        )}
      </button>
    );
  }

  return null; // done → the refreshed model speaks for itself
}
