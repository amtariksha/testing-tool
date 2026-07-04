// zod/v3 subpath: matches the SDK's zod-compat type identity (its AnySchema
// is declared against zod/v3) — the plain "zod" import fails to unify.
import { z } from "zod/v3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { checkBackend, getAppModel, runValidate, type McpDeps } from "./service";

/**
 * The three Phase-2 tools (doc §6). Results are JSON-as-text with the
 * tri-state verdict / top findings first, so a calling agent can act on the
 * first lines alone.
 */

function ok(result: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

export function registerTools(server: McpServer, deps: McpDeps): void {
  server.registerTool(
    "nirikshaka_validate",
    {
      description:
        "Run Nirikshaka's test suite against a deployment and return the tri-state " +
        "verdict: GREEN (UI + backend clean), AMBER (UI passed but backend showed " +
        "5xx/crashes — a silent failure), RED (UI failed). Blocks until the run " +
        "and its backend truth-check finish (default timeout 10 min).",
      inputSchema: {
        project: z.string().describe("Nirikshaka project id or exact name"),
        url: z
          .string()
          .optional()
          .describe("Base URL of the deployment to test (defaults to the last run's)"),
        flow: z
          .string()
          .optional()
          .describe("Suite or tag to run (defaults to the smoke suite)"),
        gitSha: z.string().optional().describe("Commit under test, recorded on the run"),
        data: z
          .record(z.string())
          .optional()
          .describe("Credential/data overrides, e.g. admin_phone / admin_otp"),
        max_cost_usd: z.number().optional().describe("LLM recovery budget cap (default $1)"),
      },
    },
    async (input) => {
      try {
        return ok(await runValidate(deps, input));
      } catch (error) {
        return fail(error);
      }
    }
  );

  server.registerTool(
    "nirikshaka_check_backend",
    {
      description:
        "No-browser backend check: did the last N minutes of telemetry show 5xx " +
        "responses, crashes, or UI errors for this project? Use after manual " +
        "testing to catch silent failures.",
      inputSchema: {
        project: z.string().describe("Nirikshaka project id or exact name"),
        since_minutes: z.number().optional().describe("Window to inspect (default 15)"),
      },
    },
    async (input) => {
      try {
        return ok(await checkBackend(deps, input));
      } catch (error) {
        return fail(error);
      }
    }
  );

  server.registerTool(
    "nirikshaka_app_model",
    {
      description:
        "Read the human-CONFIRMED app model: the feature map, flows and screens " +
        "Nirikshaka understands for this project. Pass feature for a deep slice.",
      inputSchema: {
        project: z.string().describe("Nirikshaka project id or exact name"),
        feature: z.string().optional().describe("Feature id or name for a detailed slice"),
      },
    },
    async (input) => {
      try {
        return ok(await getAppModel(deps, input));
      } catch (error) {
        return fail(error);
      }
    }
  );
}
