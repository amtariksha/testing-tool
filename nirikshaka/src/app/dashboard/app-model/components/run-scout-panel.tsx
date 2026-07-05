"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { Paperclip } from "lucide-react";

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

interface RunScoutPanelProps {
  prd: string;
  openapi: string;
  setPrd: (v: string) => void;
  setOpenapi: (v: string) => void;
  onRun: () => void;
  busy: boolean;
  empty?: boolean;
  workerDown?: boolean;
  stale?: boolean;
}

/**
 * PRD/OpenAPI input for Scout. "Attach" reads files client-side into the
 * textareas (no upload API): .md/.txt → PRD, .json → OpenAPI.
 */
export function RunScoutPanel({
  prd,
  openapi,
  setPrd,
  setOpenapi,
  onRun,
  busy,
  empty,
  workerDown,
  stale,
}: RunScoutPanelProps) {
  const prdFileRef = useRef<HTMLInputElement>(null);
  const openapiFileRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File, apply: (text: string) => void) => {
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`${file.name} is over 2 MB — paste the relevant sections instead`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => apply(String(reader.result ?? ""));
    reader.onerror = () => toast.error(`Could not read ${file.name}`);
    reader.readAsText(file);
  };

  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <h2 className="font-semibold">
        {empty ? "No model yet — run Scout" : "Re-run Scout with updated docs"}
      </h2>
      {stale && (
        <p className="text-xs text-red-400">
          The Analyst marked this model STALE — recent telemetry diverged from the confirmed model.
          Re-run Scout and re-confirm.
        </p>
      )}
      {workerDown && (
        <p className="text-xs text-yellow-400">
          Worker offline — the task will queue until it returns.
        </p>
      )}
      <div className="space-y-1">
        <textarea
          value={prd}
          onChange={(e) => setPrd(e.target.value)}
          placeholder="Paste PRD / feature doc (markdown or plain text)…"
          className="w-full h-32 bg-card border border-border rounded-lg p-3 text-sm font-mono"
        />
        <AttachButton
          label="Attach .md / .txt"
          inputRef={prdFileRef}
          accept=".md,.txt,.markdown,text/plain,text/markdown"
          onFile={(f) => readFile(f, setPrd)}
        />
      </div>
      <div className="space-y-1">
        <textarea
          value={openapi}
          onChange={(e) => setOpenapi(e.target.value)}
          placeholder="Paste OpenAPI JSON (optional)…"
          className="w-full h-24 bg-card border border-border rounded-lg p-3 text-sm font-mono"
        />
        <AttachButton
          label="Attach .json"
          inputRef={openapiFileRef}
          accept=".json,application/json"
          onFile={(f) => readFile(f, setOpenapi)}
        />
      </div>
      <button
        onClick={onRun}
        disabled={busy || (prd.trim().length === 0 && openapi.trim().length === 0)}
        className="px-4 py-2 text-sm font-semibold rounded-xl brand-gradient text-black hover:opacity-90 disabled:opacity-50"
      >
        Run Scout
      </button>
    </div>
  );
}

function AttachButton({
  label,
  inputRef,
  accept,
  onFile,
}: {
  label: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  accept: string;
  onFile: (file: File) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Paperclip className="h-3 w-3" /> {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </>
  );
}
