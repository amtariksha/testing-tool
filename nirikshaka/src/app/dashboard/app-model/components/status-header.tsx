"use client";

import { cn } from "@/lib/utils";
import { STATUS_STYLES, type LoadedModel } from "../types";

interface StatusHeaderProps {
  loaded: LoadedModel;
  discrepancyCount: number;
  busy: boolean;
  canConfirm: boolean;
  onConfirm: () => void;
  onReject: () => void;
  children?: React.ReactNode;
}

export function StatusHeader({
  loaded,
  discrepancyCount,
  busy,
  canConfirm,
  onConfirm,
  onReject,
  children,
}: StatusHeaderProps) {
  const { appModel } = loaded;
  const model = appModel.model;

  return (
    <div className="glass rounded-2xl p-5 flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center gap-4 flex-wrap">
        <span
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold",
            STATUS_STYLES[appModel.status] ?? "bg-gray-500/15"
          )}
        >
          {appModel.status}
        </span>
        <span className="text-sm text-muted-foreground">v{appModel.version}</span>
        <span className="text-sm text-muted-foreground">
          {model.features.length} features · {model.screens.length} screens ·{" "}
          {model.flows.length} flows · {model.apiChains.length} api chains ·{" "}
          {discrepancyCount} discrepancies
        </span>
        {children}
      </div>
      {canConfirm && (
        <div className="flex gap-2">
          <button
            onClick={onReject}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-border hover:bg-card disabled:opacity-50"
          >
            Reject → re-mine
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 text-sm font-semibold rounded-xl brand-gradient text-black hover:opacity-90 disabled:opacity-50"
          >
            Confirm model
          </button>
        </div>
      )}
      {appModel.status === "CONFIRMED" && appModel.confirmedBy && (
        <span className="text-xs text-muted-foreground">confirmed by {appModel.confirmedBy}</span>
      )}
    </div>
  );
}
