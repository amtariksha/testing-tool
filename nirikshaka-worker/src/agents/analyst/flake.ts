/**
 * Flake detection (doc §4.4 / §7 Phase 4) — pure. A case is a chronic flake
 * when it flip-flops pass/fail across recent runs or repeatedly only passes
 * on retry. Simple thresholds; the caller quarantines the results.
 */

export interface CaseRunHistory {
  caseId: string;
  externalId: string;
  /** Newest-first per run: "passed" | "failed" | ... and the flaky flag. */
  results: Array<{ status: string; flaky: boolean }>;
}

export interface FlakeVerdict {
  caseId: string;
  externalId: string;
  flipRate: number;
  retryFlakes: number;
  samples: number;
  chronic: boolean;
}

export interface FlakeOptions {
  windowRuns: number; // consider at most this many recent results
  minSamples: number; // need at least this many to judge
  rateThreshold: number; // flipRate ≥ this ⇒ chronic
}

export function detectFlakes(
  histories: CaseRunHistory[],
  opts: FlakeOptions
): FlakeVerdict[] {
  const verdicts: FlakeVerdict[] = [];
  for (const history of histories) {
    const window = history.results.slice(0, opts.windowRuns);
    const samples = window.length;
    if (samples < opts.minSamples) continue;

    // Only pass/fail transitions count as flips.
    const binary = window
      .map((r) => (r.status === "passed" ? 1 : r.status === "failed" ? 0 : -1))
      .filter((v) => v !== -1);
    let flips = 0;
    for (let i = 1; i < binary.length; i++) {
      if (binary[i] !== binary[i - 1]) flips++;
    }
    const flipRate = binary.length > 1 ? flips / (binary.length - 1) : 0;
    const retryFlakes = window.filter((r) => r.flaky).length;

    const chronic =
      flipRate >= opts.rateThreshold || retryFlakes >= Math.ceil(samples / 2);
    verdicts.push({
      caseId: history.caseId,
      externalId: history.externalId,
      flipRate,
      retryFlakes,
      samples,
      chronic,
    });
  }
  return verdicts;
}
