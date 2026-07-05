import type { AppModelDoc } from "../../schema/app-model";

/**
 * Staleness detection (doc §4.4) — pure. Compares recent telemetry against
 * the CONFIRMED model. STALE requires a MATERIAL diff so thin telemetry can't
 * false-flip a confirmed model (which would then block Strategist/Author).
 */

export interface ObservedTelemetry {
  screenNames: string[];
  endpoints: string[]; // "METHOD /path"
  transitions: Array<{ from: string; to: string; count: number }>;
}

export interface StalenessDiff {
  newScreens: string[];
  newEndpoints: string[];
  flowShifts: Array<{ from: string; to: string; change: number }>;
  material: boolean;
}

export interface StalenessOptions {
  flowShiftThreshold: number; // relative change > this on a supported transition
  minTransitionSupport: number;
  materialNewCount: number; // ≥ this many new screens+endpoints ⇒ material
}

function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function diffTelemetryVsModel(
  model: AppModelDoc,
  observed: ObservedTelemetry,
  opts: StalenessOptions
): StalenessDiff {
  const knownScreens = new Set(
    model.screens.flatMap((s) => [s.id, ...s.observedNames.map(slug)])
  );
  const knownEndpoints = new Set(
    model.features.flatMap((f) => f.apis.map((a) => a.trim()))
  );

  const newScreens = [
    ...new Set(observed.screenNames.map(slug).filter((s) => s && !knownScreens.has(s))),
  ];
  const newEndpoints = [
    ...new Set(observed.endpoints.filter((e) => !knownEndpoints.has(e.trim()))),
  ];

  // Flow shifts: a high-support transition whose share changed a lot vs the
  // model's recorded topTransitions.
  const modelTransition = new Map<string, number>();
  for (const screen of model.screens) {
    for (const t of screen.topTransitions) {
      modelTransition.set(`${screen.id}→${slug(t.to)}`, t.count);
    }
  }
  const flowShifts: StalenessDiff["flowShifts"] = [];
  for (const t of observed.transitions) {
    if (t.count < opts.minTransitionSupport) continue;
    const key = `${slug(t.from)}→${slug(t.to)}`;
    const prev = modelTransition.get(key) ?? 0;
    const denom = Math.max(prev, 1);
    const change = Math.abs(t.count - prev) / denom;
    if (change > opts.flowShiftThreshold && prev > 0) {
      flowShifts.push({ from: t.from, to: t.to, change });
    }
  }

  const material =
    newScreens.length + newEndpoints.length >= opts.materialNewCount ||
    flowShifts.length > 0;

  return { newScreens, newEndpoints, flowShifts, material };
}
