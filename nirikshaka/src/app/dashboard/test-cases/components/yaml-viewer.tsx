"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function YamlViewer({ yaml }: { yaml: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — no-op
    }
  };
  return (
    <div className="relative">
      <button
        onClick={copy}
        className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-card border border-border rounded px-2 py-1"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="text-xs font-mono bg-card border border-border rounded-lg p-3 overflow-x-auto max-h-96">
        {yaml}
      </pre>
    </div>
  );
}
