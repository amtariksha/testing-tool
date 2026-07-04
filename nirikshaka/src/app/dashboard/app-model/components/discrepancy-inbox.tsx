"use client";

import type { Discrepancy } from "../types";

export function DiscrepancyInbox({ discrepancies }: { discrepancies: Discrepancy[] }) {
  if (discrepancies.length === 0) return null;
  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="font-semibold mb-2 text-yellow-400">Discrepancy inbox</h2>
      <ul className="space-y-2 text-sm">
        {discrepancies.map((d, i) => (
          <li key={i}>
            <span className="text-muted-foreground">[{d.claim}]</span> spec: {d.specSays} ·{" "}
            telemetry: {d.telemetrySays}
          </li>
        ))}
      </ul>
    </div>
  );
}
