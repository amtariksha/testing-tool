"use client";

interface RunScoutPanelProps {
  prd: string;
  openapi: string;
  setPrd: (v: string) => void;
  setOpenapi: (v: string) => void;
  onRun: () => void;
  busy: boolean;
  empty?: boolean;
}

export function RunScoutPanel({
  prd,
  openapi,
  setPrd,
  setOpenapi,
  onRun,
  busy,
  empty,
}: RunScoutPanelProps) {
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <h2 className="font-semibold">
        {empty ? "No model yet — run Scout" : "Re-run Scout with updated docs"}
      </h2>
      <textarea
        value={prd}
        onChange={(e) => setPrd(e.target.value)}
        placeholder="Paste PRD / feature doc (markdown or plain text)…"
        className="w-full h-32 bg-card border border-border rounded-lg p-3 text-sm font-mono"
      />
      <textarea
        value={openapi}
        onChange={(e) => setOpenapi(e.target.value)}
        placeholder="Paste OpenAPI JSON (optional)…"
        className="w-full h-24 bg-card border border-border rounded-lg p-3 text-sm font-mono"
      />
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
