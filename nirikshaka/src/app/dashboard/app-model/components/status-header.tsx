"use client";

import { cn } from "@/lib/utils";
import { STATUS_STYLES, type LoadedModel } from "../types";

export interface VersionOption {
  id: string;
  version: number;
  status: string;
}

interface StatusHeaderProps {
  loaded: LoadedModel;
  discrepancyCount: number;
  busy: boolean;
  canConfirm: boolean;
  onConfirm: () => void;
  onReject: () => void;
  versions?: VersionOption[];
  selectedVersionId?: string | null;
  onSelectVersion?: (id: string | null) => void;
  isHistorical?: boolean;
  children?: React.ReactNode;
}

export function StatusHeader({
  loaded,
  discrepancyCount,
  busy,
  canConfirm,
  onConfirm,
  onReject,
  versions,
  selectedVersionId,
  onSelectVersion,
  isHistorical,
  children,
}: StatusHeaderProps) {
  const { appModel } = loaded;
  const model = appModel.model;
  const latestVersion = versions?.[0]?.version;

  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      {isHistorical && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-400 flex items-center justify-between gap-2 flex-wrap">
          <span>
            Viewing v{appModel.version} (historical) — read-only.
            {latestVersion !== undefined && ` Latest is v${latestVersion}.`}
          </span>
          <button onClick={() => onSelectVersion?.(null)} className="text-xs underline">
            Back to latest
          </button>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-4">
      <div className="flex items-center gap-4 flex-wrap">
        <span
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold",
            STATUS_STYLES[appModel.status] ?? "bg-gray-500/15"
          )}
        >
          {appModel.status}
        </span>
        {versions && versions.length > 1 && onSelectVersion ? (
          <select
            value={selectedVersionId ?? versions[0].id}
            onChange={(e) =>
              onSelectVersion(e.target.value === versions[0].id ? null : e.target.value)
            }
            className="bg-card border border-border rounded-lg px-2 py-1 text-xs"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version} · {v.status}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-muted-foreground">v{appModel.version}</span>
        )}
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
    </div>
  );
}
