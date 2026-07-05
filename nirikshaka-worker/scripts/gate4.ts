import { loadConfig } from "../src/config";
import { createPrismaClient } from "../src/db/client";

/**
 * Gate 4 (launch bar, informational, doc §7): flake rate across recent runs,
 * quarantine count, and whether the Analyst scheduler has run.
 *
 *   pnpm gate:4 --project <id>
 */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const projectId = arg("project") ?? process.env.PILOT_PROJECT_ID;
  if (!projectId) {
    console.error("usage: pnpm gate:4 --project <id>");
    process.exit(1);
  }
  const config = loadConfig();
  const prisma = createPrismaClient(config.DATABASE_URL);

  const [active, quarantined, stale, scheduler] = await Promise.all([
    prisma.testCase.count({ where: { projectId, status: "ACTIVE" } }),
    prisma.testCase.count({ where: { projectId, status: "QUARANTINED" } }),
    prisma.appModel.count({ where: { projectId, status: "STALE" } }),
    prisma.agentHeartbeat.findUnique({ where: { agent: "analyst-scheduler" } }),
  ]);

  const results = await prisma.testCaseResult.findMany({
    where: { run: { projectId } },
    orderBy: { id: "desc" },
    take: 500,
    select: { verdict: true, status: true },
  });
  const flaky = results.filter(
    (r) => (r.verdict as { flaky?: boolean } | null)?.flaky === true
  ).length;
  const flakePct = results.length ? ((flaky / results.length) * 100).toFixed(1) : "0";

  console.log("── Gate 4 (launch bar) ─────────────────");
  console.log(`ACTIVE cases:        ${active}`);
  console.log(`QUARANTINED:         ${quarantined}`);
  console.log(`STALE models:        ${stale}`);
  console.log(`flake rate (last ${results.length}): ${flakePct}%  (target <5%)`);
  console.log(
    `analyst scheduler:   ${
      scheduler ? `last ran ${scheduler.lastBeatAt.toISOString()}` : "has not run yet"
    }`
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
