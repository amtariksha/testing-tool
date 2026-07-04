import {
  appModelSchema,
  type AppModelDoc,
  type Feature,
  type Screen,
  type Entity,
  type Role,
  type EvidenceIndex,
  type Discrepancy,
} from "../../schema/app-model";
import type { ModelFragment } from "./types";

/**
 * Fuse (implementation doc §4.1 L4). Deterministically merges miner fragments
 * into ONE app model, unions evidence, and surfaces spec-vs-telemetry conflicts
 * as explicit discrepancies. No LLM — merge logic is pure and testable.
 */

export interface FusedModel {
  model: AppModelDoc;
  evidence: EvidenceIndex;
  discrepancies: Discrepancy[];
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()];
}

function mergeScreens(fragments: ModelFragment[]): Screen[] {
  const byId = new Map<string, Screen>();
  for (const frag of fragments) {
    for (const screen of frag.screens ?? []) {
      const existing = byId.get(screen.id);
      if (!existing) {
        byId.set(screen.id, { ...screen });
      } else {
        existing.observedNames = [
          ...new Set([...existing.observedNames, ...screen.observedNames]),
        ];
        existing.avgDurationMs = existing.avgDurationMs ?? screen.avgDurationMs;
        if (screen.topTransitions.length > existing.topTransitions.length) {
          existing.topTransitions = screen.topTransitions;
        }
      }
    }
  }
  return [...byId.values()];
}

export function fuse(fragments: ModelFragment[]): FusedModel {
  const features = dedupeById(fragments.flatMap((f) => f.features ?? []) as Feature[]);
  const screens = mergeScreens(fragments);
  const flows = fragments.flatMap((f) => f.flows ?? []);
  const apiChains = fragments.flatMap((f) => f.apiChains ?? []);
  const roles = dedupeById(fragments.flatMap((f) => f.roles ?? []) as Role[]);
  const entities = dedupeById(fragments.flatMap((f) => f.entities ?? []) as Entity[]);

  const evidence: EvidenceIndex = {};
  for (const frag of fragments) {
    for (const [key, refs] of Object.entries(frag.evidence)) {
      evidence[key] = [...(evidence[key] ?? []), ...refs];
    }
  }

  // Coverage boundaries: low-confidence features need a human before testing.
  const needsHuman = features
    .filter((f) => f.confidence < 0.6)
    .map((f) => f.id);
  const agentCanTest = features
    .filter((f) => f.confidence >= 0.6)
    .map((f) => f.id);

  // Discrepancies: spec features referencing screens telemetry never observed.
  const observedScreens = new Set(screens.map((s) => s.id));
  const discrepancies: Discrepancy[] = [];
  const hasTelemetry = observedScreens.size > 0;
  if (hasTelemetry) {
    for (const feature of features) {
      const missing = feature.screens.filter((s) => !observedScreens.has(s));
      if (missing.length > 0) {
        discrepancies.push({
          claim: `feature:${feature.id}`,
          specSays: `uses screens: ${feature.screens.join(", ")}`,
          telemetrySays: `never observed: ${missing.join(", ")}`,
        });
      }
    }
  }

  const model = appModelSchema.parse({
    features,
    screens,
    flows,
    apiChains,
    roles,
    entities,
    coverage_boundaries: { agent_can_test: agentCanTest, needs_human: needsHuman },
  });

  return { model, evidence, discrepancies };
}
