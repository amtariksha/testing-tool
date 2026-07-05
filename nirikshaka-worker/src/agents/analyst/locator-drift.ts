/**
 * Locator-drift report (doc §7 Phase 4) — pure. Flags cache entries whose
 * confidence has fallen or that the runner keeps having to recover. Report-
 * only; the Analyst never edits the cache.
 */

export interface LocatorSample {
  semanticKey: string;
  confidence: number;
  recoveryCount: number; // times the runner recovered this key in the window
}

export interface DriftFinding {
  semanticKey: string;
  confidence: number;
  recoveryCount: number;
  reason: "low-confidence" | "frequent-recovery";
}

export function computeDrift(
  samples: LocatorSample[],
  opts: { confidenceThreshold: number; recoveryThreshold: number }
): DriftFinding[] {
  const findings: DriftFinding[] = [];
  for (const s of samples) {
    if (s.confidence <= opts.confidenceThreshold) {
      findings.push({ ...s, reason: "low-confidence" });
    } else if (s.recoveryCount >= opts.recoveryThreshold) {
      findings.push({ ...s, reason: "frequent-recovery" });
    }
  }
  return findings.sort((a, b) => a.confidence - b.confidence);
}
