import { complete, loadPrompt } from "../../llm/client";
import type { AppModelDoc, Feature, Flow } from "../../schema/app-model";
import { parseTestYaml, type TestCaseDoc } from "../../schema/test-yaml";
import type { CoverageEntry } from "../../schema/strategy";
import type { ConvertCase } from "./md-import";
import { pickTier } from "./tier";
import { generateValidated } from "./validate";

/**
 * Per-case LLM orchestration. The generator returns raw YAML; validation via
 * parseTestYaml feeds errors back through generateValidated.
 */

export interface GeneratedCase {
  doc: TestCaseDoc;
  yamlText: string;
  attempts: number;
  costUsd: number;
  tier: string;
}

export interface CaseSpec {
  externalId: string;
  suite: string;
  feature: Feature;
  flow: Flow | null;
  coverage: CoverageEntry;
  caseNumber: number;
  priorFindings?: Array<{ severity: string; claim: string; detail: string }>;
}

function modelSlice(model: AppModelDoc, feature: Feature, flow: Flow | null) {
  return {
    feature,
    flow,
    flows: model.flows.filter((f) => f.featureId === feature.id).slice(0, 5),
    screens: model.screens.filter((s) => feature.screens.includes(s.id)),
    roles: model.roles.filter((r) => feature.roles.includes(r.id)),
  };
}

export async function generateCase(
  model: AppModelDoc,
  spec: CaseSpec,
  maxRetries: number,
  mode: "strategy" | "regenerate" = "strategy"
): Promise<GeneratedCase> {
  const system = await loadPrompt("author-generate");
  const stateChanging = spec.feature.states.length > 0;
  let attempt = 0;
  let lastTier = "haiku";

  const result = await generateValidated(
    async (feedback) => {
      attempt += 1;
      const tier = pickTier({
        mode,
        stepCount: spec.flow?.steps.length,
        roleCount: spec.feature.roles.length,
        stateChanging,
        attempt,
      });
      lastTier = tier;
      const user = JSON.stringify(
        {
          externalId: spec.externalId,
          suite: spec.suite,
          priority: spec.coverage.priority,
          caseNumber: spec.caseNumber,
          caseBudget: spec.coverage.caseBudget,
          model: modelSlice(model, spec.feature, spec.flow),
          reviewerFindings: spec.priorFindings ?? [],
          validationFeedback: feedback ?? null,
        },
        null,
        2
      );
      const response = await complete({ tier, system, user, maxTokens: 4096 });
      return { text: response.text, costUsd: response.costUsd };
    },
    (text) => {
      const doc = parseTestYaml(text);
      if (doc.id !== spec.externalId) {
        throw new Error(`id must be "${spec.externalId}", got "${doc.id}"`);
      }
      if (doc.crossApp) throw new Error("single-app format required (no apps: block)");
      return doc;
    },
    maxRetries
  );

  return { ...result, tier: lastTier };
}

export async function convertCase(
  input: ConvertCase & { suite: string },
  maxRetries: number
): Promise<GeneratedCase> {
  const system = await loadPrompt("author-convert");
  let attempt = 0;
  let lastTier = "haiku";

  const result = await generateValidated(
    async (feedback) => {
      attempt += 1;
      const tier = pickTier({ mode: "convert", attempt });
      lastTier = tier;
      const user = JSON.stringify(
        {
          externalId: input.externalId,
          suite: input.suite,
          title: input.title,
          manualSteps: input.steps,
          expectedResults: input.expected,
          validationFeedback: feedback ?? null,
        },
        null,
        2
      );
      const response = await complete({ tier, system, user, maxTokens: 4096 });
      return { text: response.text, costUsd: response.costUsd };
    },
    (text) => {
      const doc = parseTestYaml(text);
      if (doc.id !== input.externalId) {
        throw new Error(`id must be "${input.externalId}", got "${doc.id}"`);
      }
      return doc;
    },
    maxRetries
  );

  return { ...result, tier: lastTier };
}
