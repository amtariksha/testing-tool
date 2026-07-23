import { z } from "zod";
import { completeStructured, loadPrompt } from "../../llm/client";
import {
  featureSchema,
  roleSchema,
  entitySchema,
  type Entity,
} from "../../schema/app-model";
import type { ModelFragment } from "./types";
import type { EvidenceIndex } from "../../schema/app-model";

/**
 * SpecMiner (implementation doc §4.1 L3). Two sources:
 *  - OpenAPI (JSON): parsed deterministically into entities + endpoints
 *  - PRD / feature doc (text): mined with Sonnet into features/roles/entities
 */

export interface SpecSource {
  type: "prd" | "openapi";
  content: string;
}

const specLlmOutputSchema = z.object({
  features: z.array(featureSchema).default([]),
  roles: z.array(roleSchema).default([]),
  entities: z.array(entitySchema).default([]),
});

function slugify(name: string): string {
  return (
    name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
    "item"
  );
}

/** Deterministically parse an OpenAPI (JSON) doc into entities + endpoint list. */
export function parseOpenApi(content: string): {
  entities: Entity[];
  endpoints: string[];
  evidence: EvidenceIndex;
} {
  let doc: unknown;
  try {
    doc = JSON.parse(content);
  } catch {
    throw new Error("SpecMiner: OpenAPI source is not valid JSON (YAML not yet supported)");
  }
  const root = (doc ?? {}) as {
    paths?: Record<string, Record<string, unknown>>;
    components?: { schemas?: Record<string, { properties?: Record<string, unknown> }> };
  };

  const evidence: EvidenceIndex = {};

  const entities: Entity[] = Object.entries(root.components?.schemas ?? {}).map(
    ([name, schema]) => {
      const id = slugify(name);
      evidence[`entity:${id}`] = [
        { source: "openapi", ref: `components.schemas.${name}`, confidence: 1 },
      ];
      return { id, name, fields: Object.keys(schema.properties ?? {}) };
    }
  );

  const endpoints: string[] = [];
  for (const [pathName, methods] of Object.entries(root.paths ?? {})) {
    for (const method of Object.keys(methods)) {
      if (["get", "post", "put", "patch", "delete"].includes(method.toLowerCase())) {
        const endpoint = `${method.toUpperCase()} ${pathName}`;
        endpoints.push(endpoint);
        evidence[`api:${endpoint}`] = [
          { source: "openapi", ref: `paths.${pathName}.${method}`, confidence: 1 },
        ];
      }
    }
  }

  return { entities, endpoints, evidence };
}

/** Mine a PRD / feature doc with the LLM into features/roles/entities. */
export async function minePrd(content: string): Promise<{
  fragment: ModelFragment;
  costUsd: number;
}> {
  const system = await loadPrompt("spec-miner");
  // Forced tool-use: syntactically valid JSON guaranteed by the API. One
  // retry with the shape error fed back covers rare schema misses.
  let costUsd = 0;
  let parsed: ReturnType<typeof specLlmOutputSchema.parse>;
  const callOnce = async (feedback?: string) => {
    const result = await completeStructured({
      tier: "sonnet",
      system,
      user: `Application spec document:\n\n${content}` + (feedback ? `\n\n${feedback}` : ""),
      maxTokens: 16384,
    });
    costUsd += result.costUsd;
    return result.value;
  };
  try {
    parsed = specLlmOutputSchema.parse(await callOnce());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    parsed = specLlmOutputSchema.parse(
      await callOnce(`Your previous result had the wrong shape (${message}). Emit the corrected full result.`)
    );
  }
  const evidence: EvidenceIndex = {};
  for (const feature of parsed.features) {
    evidence[`feature:${feature.id}`] = [
      { source: "prd", ref: feature.name, confidence: feature.confidence },
    ];
  }
  return {
    fragment: {
      features: parsed.features,
      roles: parsed.roles,
      entities: parsed.entities,
      evidence,
    },
    costUsd,
  };
}

/** Mine all provided spec sources into one fragment. */
export async function mineSpec(sources: SpecSource[]): Promise<{
  fragment: ModelFragment;
  costUsd: number;
}> {
  const features: ModelFragment["features"] = [];
  const roles: ModelFragment["roles"] = [];
  const entities: Entity[] = [];
  const evidence: EvidenceIndex = {};
  let costUsd = 0;

  const mergeEvidence = (add: EvidenceIndex): void => {
    for (const [key, refs] of Object.entries(add)) {
      evidence[key] = [...(evidence[key] ?? []), ...refs];
    }
  };

  for (const source of sources) {
    if (source.type === "openapi") {
      const parsed = parseOpenApi(source.content);
      entities.push(...parsed.entities);
      mergeEvidence(parsed.evidence);
    } else {
      const { fragment, costUsd: c } = await minePrd(source.content);
      costUsd += c;
      features.push(...(fragment.features ?? []));
      roles.push(...(fragment.roles ?? []));
      entities.push(...(fragment.entities ?? []));
      mergeEvidence(fragment.evidence);
    }
  }

  return { fragment: { features, roles, entities, evidence }, costUsd };
}
