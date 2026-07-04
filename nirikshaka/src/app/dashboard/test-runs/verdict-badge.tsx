"use client";

import { cn } from "@/lib/utils";

const VERDICT_STYLES: Record<string, string> = {
  GREEN: "bg-green-500/15 text-green-400",
  AMBER: "bg-yellow-500/15 text-yellow-400",
  RED: "bg-red-500/15 text-red-400",
};

export function VerdictBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-xs font-semibold",
        VERDICT_STYLES[verdict] ?? "bg-gray-500/15 text-gray-400"
      )}
    >
      {verdict}
    </span>
  );
}
