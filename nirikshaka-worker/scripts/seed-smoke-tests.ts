import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../src/config";
import { createPrismaClient } from "../src/db/client";
import { hashYaml, parseTestYaml } from "../src/schema/test-yaml";

/**
 * Seed the hand-written smoke suite (doc §7 Phase 2) into TestCase rows.
 * Idempotent: upserts on (projectId, externalId); unchanged yamlHash → skip.
 *
 *   pnpm seed:smoke --project <projectId> [--dir testcases/communityos-admin]
 */

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const projectId = arg("project") ?? process.env.PILOT_PROJECT_ID;
  if (!projectId) {
    console.error("usage: pnpm seed:smoke --project <projectId>  (or PILOT_PROJECT_ID env)");
    process.exit(1);
  }
  const dir = path.resolve(
    __dirname,
    "..",
    arg("dir") ?? path.join("testcases", "communityos-admin")
  );

  const config = loadConfig();
  const prisma = createPrismaClient(config.DATABASE_URL);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    console.error(`project ${projectId} not found`);
    process.exit(1);
  }

  const files = (await readdir(dir)).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const file of files.sort()) {
    const yamlText = await readFile(path.join(dir, file), "utf8");
    const doc = parseTestYaml(yamlText); // fails loudly on schema drift
    const yamlHash = hashYaml(yamlText);

    const existing = await prisma.testCase.findUnique({
      where: { projectId_externalId: { projectId, externalId: doc.id } },
    });
    if (existing && existing.yamlHash === yamlHash) {
      skipped++;
      console.log(`= ${doc.id} unchanged`);
      continue;
    }

    await prisma.testCase.upsert({
      where: { projectId_externalId: { projectId, externalId: doc.id } },
      create: {
        projectId,
        externalId: doc.id,
        name: doc.name,
        suite: doc.suite,
        platform: doc.platform,
        yaml: yamlText,
        yamlHash,
        tags: doc.tags,
        skipAgent: false,
        needsReview: false, // hand-written = pre-approved
        confidence: "high",
        generatedFrom: { type: "hand-written", file },
        status: "ACTIVE",
      },
      update: {
        name: doc.name,
        suite: doc.suite,
        platform: doc.platform,
        yaml: yamlText,
        yamlHash,
        tags: doc.tags,
        generatedFrom: { type: "hand-written", file },
      },
    });
    if (existing) {
      updated++;
      console.log(`~ ${doc.id} updated`);
    } else {
      created++;
      console.log(`+ ${doc.id} created (ACTIVE)`);
    }
  }

  console.log(
    `\nseeded ${files.length} case(s) into ${project.name}: ${created} created, ${updated} updated, ${skipped} unchanged`
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
