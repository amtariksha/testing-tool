import { loadConfig } from "../src/config";
import { createPrismaClient } from "../src/db/client";

/**
 * Gate 3 (informational, doc §7): ACTIVE case count (target ≥150), last
 * full-run duration/cost, and recent flake rate for the pilot project.
 *
 *   pnpm gate:3 --project <id>
 */
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const projectId = arg("project") ?? process.env.PILOT_PROJECT_ID;
  if (!projectId) {
    console.error("usage: pnpm gate:3 --project <id>");
    process.exit(1);
  }
  const config = loadConfig();
  const prisma = createPrismaClient(config.DATABASE_URL);

  const [active, draft, needsHuman] = await Promise.all([
    prisma.testCase.count({ where: { projectId, status: "ACTIVE" } }),
    prisma.testCase.count({ where: { projectId, status: "DRAFT", needsReview: true } }),
    prisma.testCase.count({ where: { projectId, tags: { has: "needs-human" } } }),
  ]);

  const lastRun = await prisma.testRun.findFirst({
    where: { projectId, status: { in: ["passed", "failed"] } },
    orderBy: { startedAt: "desc" },
  });

  const recentResults = await prisma.testCaseResult.findMany({
    where: { run: { projectId } },
    orderBy: { id: "desc" },
    take: 200,
    select: { verdict: true },
  });
  const flaky = recentResults.filter(
    (r) => (r.verdict as { flaky?: boolean } | null)?.flaky === true
  ).length;
  const flakePct = recentResults.length ? ((flaky / recentResults.length) * 100).toFixed(1) : "0";

  console.log("── Gate 3 ──────────────────────────────");
  console.log(`ACTIVE cases:        ${active}  (target ≥150)`);
  console.log(`DRAFT/needsReview:   ${draft}`);
  console.log(`needs-human flagged: ${needsHuman}`);
  if (lastRun) {
    const durationMs =
      lastRun.startedAt && lastRun.finishedAt
        ? lastRun.finishedAt.getTime() - lastRun.startedAt.getTime()
        : null;
    console.log(
      `last full run:       ${lastRun.status}, ${
        durationMs ? Math.round(durationMs / 1000) + "s" : "?"
      }, $${Number(lastRun.costUsd ?? 0).toFixed(4)}  (target <30min, <₹50)`
    );
  } else {
    console.log("last full run:       none yet");
  }
  console.log(`flake rate (last ${recentResults.length}): ${flakePct}%  (target <10%)`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
