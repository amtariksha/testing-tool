"use client";

import { cn } from "@/lib/utils";
import type { CaseRow } from "../actions";
import { YamlViewer } from "./yaml-viewer";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-gray-400",
};

const VERDICT_STYLES: Record<string, string> = {
  approved: "bg-green-500/15 text-green-400",
  rejected: "bg-red-500/15 text-red-400",
  needs_human: "bg-yellow-500/15 text-yellow-400",
};

interface CaseRowProps {
  testCase: CaseRow;
  isOpen: boolean;
  busy: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: (mode: "retire" | "regenerate") => void;
  onUnquarantine?: () => void;
}

export function CaseCard({
  testCase,
  isOpen,
  busy,
  onToggle,
  onApprove,
  onReject,
  onUnquarantine,
}: CaseRowProps) {
  return (
    <div className="glass rounded-xl p-3">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-3 text-left">
        <span className="text-sm font-medium truncate">
          <span className="text-muted-foreground font-mono text-xs">{testCase.externalId}</span>{" "}
          {testCase.name}
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {testCase.verdict && (
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-xs",
                VERDICT_STYLES[testCase.verdict] ?? "bg-gray-500/15 text-gray-400"
              )}
            >
              {testCase.verdict}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{testCase.confidence}</span>
        </span>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          {testCase.findings.length > 0 && (
            <ul className="space-y-1">
              {testCase.findings.map((f, i) => (
                <li key={i} className="text-xs">
                  <span className={cn("uppercase font-semibold", SEVERITY_STYLES[f.severity])}>
                    {f.severity}
                  </span>{" "}
                  <span className="text-muted-foreground">[{f.claim}]</span> {f.detail}
                  {f.suggestedFix && (
                    <span className="block text-muted-foreground">fix: {f.suggestedFix}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <YamlViewer yaml={testCase.yaml} />
          <div className="flex flex-wrap gap-2">
            {onUnquarantine ? (
              <button
                onClick={onUnquarantine}
                disabled={busy}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg brand-gradient text-black disabled:opacity-50"
              >
                Unquarantine → ACTIVE
              </button>
            ) : (
              <>
                <button
                  onClick={onApprove}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg brand-gradient text-black disabled:opacity-50"
                >
                  Approve → ACTIVE
                </button>
                <button
                  onClick={() => onReject("regenerate")}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-card disabled:opacity-50"
                >
                  Regenerate
                </button>
                <button
                  onClick={() => onReject("retire")}
                  disabled={busy}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-card text-red-400 disabled:opacity-50"
                >
                  Retire
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
