import { readFile } from "node:fs/promises";
import type { Prisma } from "@prisma/client";
import { loadConfig } from "../src/config";
import { createPrismaClient } from "../src/db/client";
import { parseMdCases } from "../src/agents/author/md-import";

/**
 * Import a manual markdown test-case catalog (e.g. the 260-case CommunityOS
 * file) as Author convert tasks — one per chunk of N cases so agent_tasks
 * payloads stay small and the import is resumable/parallel.
 *
 *   pnpm import:md --project <id> --file <path.md> --suite <name> [--chunk 10]
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const projectId = arg("project") ?? process.env.PILOT_PROJECT_ID;
  const file = arg("file");
  const suite = arg("suite") ?? "imported";
  const chunk = Number(arg("chunk") ?? 10);
  if (!projectId || !file) {
    console.error("usage: pnpm import:md --project <id> --file <path.md> --suite <name> [--chunk 10]");
    process.exit(1);
  }

  const config = loadConfig();
  const prisma = createPrismaClient(config.DATABASE_URL);
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    console.error(`project ${projectId} not found`);
    process.exit(1);
  }

  const md = await readFile(file, "utf8");
  const cases = parseMdCases(md);
  if (cases.length === 0) {
    console.error("no cases parsed — expected `## Heading` per case with list-item steps");
    process.exit(1);
  }
  console.log(`parsed ${cases.length} case(s) from ${file}`);

  let tasks = 0;
  for (let i = 0; i < cases.length; i += chunk) {
    await prisma.agentTask.create({
      data: {
        type: "generate_tests",
        projectId,
        payload: {
          mode: "convert",
          suite,
          cases: cases.slice(i, i + chunk),
        } as unknown as Prisma.InputJsonValue,
      },
    });
    tasks++;
  }
  console.log(
    `enqueued ${tasks} convert task(s) of up to ${chunk} case(s) each into ${project.name} (suite: ${suite}).\n` +
      `The worker will generate + Critic-review them; approve in the dashboard's Test Cases queue.`
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
