import { z } from "zod";

/**
 * Test strategy document (doc §7 Phase 3): the Strategist's coverage matrix
 * stored in TestStrategy.strategy (Json) and consumed by the Author.
 */

export const coverageEntrySchema = z.object({
  featureId: z.string(),
  priority: z.enum(["P0", "P1", "P2"]),
  flowIds: z.array(z.string()).default([]),
  caseBudget: z.number().int().positive(),
  skipAgent: z.boolean().default(false),
  reason: z.string().optional(),
});
export type CoverageEntry = z.infer<typeof coverageEntrySchema>;

export const suiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  featureIds: z.array(z.string()).default([]),
});

export const testStrategySchema = z.object({
  appModelId: z.string().optional(), // stamped by the handler
  appModelVersion: z.number().int().optional(),
  suites: z.array(suiteSchema).default([]),
  coverage: z.array(coverageEntrySchema).default([]),
  /** Feature ids the agent must NOT test (mirrors coverage_boundaries). */
  skip_agent: z.array(z.string()).default([]),
  totalCaseBudget: z.number().int().nonnegative().default(0),
  notes: z.string().optional(),
});
export type TestStrategyDoc = z.infer<typeof testStrategySchema>;
