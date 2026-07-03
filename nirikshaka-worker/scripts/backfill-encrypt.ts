/**
 * Backfill: encrypt plaintext APIRequest.requestBody/responseBody rows
 * (implementation doc D12). Idempotent — already-encrypted rows are skipped
 * by the WHERE clause, so it is safe to re-run after an interruption.
 *
 * Usage:
 *   pnpm backfill:encrypt            # encrypt everything pending
 *   pnpm backfill:encrypt -- --dry-run
 */
import { loadConfig } from "../src/config";
import { createPrismaClient } from "../src/db/client";
import { encryptString, isEncryptionConfigured } from "../src/crypto/envelope";

const BATCH_SIZE = 200;

interface PendingRow {
  id: string;
  projectId: string;
  requestBody: string | null;
  responseBody: string | null;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const config = loadConfig();

  if (!isEncryptionConfigured()) {
    throw new Error("NIRIKSHAKA_MASTER_KEY must be set to run the backfill");
  }

  const prisma = createPrismaClient(config.DATABASE_URL);
  let totalUpdated = 0;

  try {
    for (;;) {
      const rows = await prisma.$queryRaw<PendingRow[]>`
        SELECT id, "projectId", "requestBody", "responseBody"
        FROM api_requests
        WHERE ("requestBody" IS NOT NULL AND "requestBody" <> '' AND "requestBody" NOT LIKE 'enc:v1:%')
           OR ("responseBody" IS NOT NULL AND "responseBody" <> '' AND "responseBody" NOT LIKE 'enc:v1:%')
        ORDER BY id
        LIMIT ${BATCH_SIZE};
      `;

      if (rows.length === 0) break;

      if (dryRun) {
        totalUpdated += rows.length;
        console.log(`[backfill] dry-run: ${rows.length} rows would be encrypted`);
        break;
      }

      for (const row of rows) {
        const needsRequest =
          row.requestBody !== null &&
          row.requestBody !== "" &&
          !row.requestBody.startsWith("enc:v1:");
        const needsResponse =
          row.responseBody !== null &&
          row.responseBody !== "" &&
          !row.responseBody.startsWith("enc:v1:");

        await prisma.aPIRequest.update({
          where: { id: row.id },
          data: {
            ...(needsRequest
              ? { requestBody: encryptString(row.requestBody as string, row.projectId) }
              : {}),
            ...(needsResponse
              ? { responseBody: encryptString(row.responseBody as string, row.projectId) }
              : {}),
          },
        });
        totalUpdated += 1;
      }

      console.log(`[backfill] encrypted ${totalUpdated} rows so far…`);
    }

    console.log(
      dryRun
        ? `[backfill] dry-run complete — ${totalUpdated}+ rows pending encryption`
        : `[backfill] done — ${totalUpdated} rows encrypted`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "[backfill] failed:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
});
