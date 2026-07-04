/**
 * Live end-to-end smoke of the Scout→Critic pipeline against the real DB + LLM,
 * using a synthetic spec (stands in for CommunityOS docs until they arrive).
 * Cleans up the rows it creates. Run: npx tsx scripts/e2e-scout.ts <projectId>
 */
import "dotenv/config";
import { loadConfig } from "../src/config";
import { createPrismaClient } from "../src/db/client";
import { createSqlPool, asQueryable } from "../src/db/sql";
import { createRealtimePublisher } from "../src/realtime";
import { handleFuseModel } from "../src/agents/scout";
import { handleReviewModel } from "../src/agents/critic";
import type { TaskContext } from "../src/tasks/registry";
import type { AgentTask } from "@prisma/client";

const PRD = `
# CommunityOS — Maintenance Requests (resident app)

Residents raise maintenance requests for their unit. A request has a category,
description, optional photos, and moves through states: open -> assigned ->
in_progress -> completed -> closed. Community admins assign requests to vendors.
Vendors update job status. Residents can view a list of their requests and a
detail view. Only the resident who created a request or a community admin can
close it. Raising a request requires the resident to be logged in and to belong
to a unit.
`;

const OPENAPI = JSON.stringify({
  paths: {
    "/api/requests": { post: {}, get: {} },
    "/api/requests/{id}/assign": { patch: {} },
    "/api/requests/{id}/status": { patch: {} },
  },
  components: {
    schemas: {
      Request: { properties: { id: {}, category: {}, description: {}, status: {}, unitId: {} } },
      Unit: { properties: { id: {}, block: {}, number: {} } },
    },
  },
});

async function main(): Promise<void> {
  const projectId = process.argv[2];
  if (!projectId) throw new Error("usage: e2e-scout.ts <projectId>");

  const config = loadConfig();
  const prisma = createPrismaClient(config.DATABASE_URL);
  const sqlPool = createSqlPool(config.DATABASE_URL);
  const realtime = createRealtimePublisher(config);
  const ctx: TaskContext = { prisma, config, realtime, sql: asQueryable(sqlPool) };

  const fuseTask = {
    id: "e2e-fuse",
    type: "fuse_model",
    projectId,
    payload: { sources: [
      { type: "prd", content: PRD },
      { type: "openapi", content: OPENAPI },
    ] },
  } as unknown as AgentTask;

  console.log("→ running fuse_model (SpecMiner + Fuse)…");
  const fuseResult = await handleFuseModel(fuseTask, ctx);
  console.log("fuse_model result:", JSON.stringify(fuseResult, null, 2));
  const appModelId = fuseResult.appModelId as string;

  const reviewTask = {
    id: "e2e-review",
    type: "review_model",
    projectId,
    payload: { appModelId },
  } as unknown as AgentTask;

  console.log("→ running review_model (Critic)…");
  const reviewResult = await handleReviewModel(reviewTask, ctx);
  console.log("review_model result:", JSON.stringify(reviewResult, null, 2));

  const stored = await prisma.appModel.findUnique({ where: { id: appModelId } });
  const model = stored?.model as { features?: { id: string; name: string; confidence: number }[] };
  console.log("\nSTORED AppModel status:", stored?.status);
  console.log("features mined:");
  for (const f of model.features ?? []) console.log(`  - ${f.name} (${f.id}) conf=${f.confidence}`);

  // Cleanup: remove the rows this smoke created + the enqueued review task.
  await prisma.critique.deleteMany({ where: { targetId: appModelId } });
  await prisma.agentTask.deleteMany({ where: { type: "review_model", projectId } });
  await prisma.appModel.delete({ where: { id: appModelId } });
  console.log("\ncleaned up e2e rows.");

  await realtime.close();
  await sqlPool.end();
  await prisma.$disconnect();
}

main().catch((e: unknown) => {
  console.error("E2E FAILED:", e instanceof Error ? e.stack ?? e.message : e);
  process.exit(1);
});
