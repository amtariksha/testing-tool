import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { Pool, type PoolConfig } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * TLS behavior:
 * - default: honor sslmode from the connection string with full verification
 * - DATABASE_CA_CERT: path to a CA bundle (e.g. Supabase's pooler CA) to trust
 * - DATABASE_SSL_NO_VERIFY=true: explicit opt-out for environments where the
 *   pooler cert cannot be verified — prefer DATABASE_CA_CERT instead
 */
function resolveSsl(): PoolConfig["ssl"] {
  const caPath = process.env.DATABASE_CA_CERT;
  if (caPath) {
    return { ca: readFileSync(caPath, "utf8") };
  }
  if (process.env.DATABASE_SSL_NO_VERIFY === "true") {
    console.warn(
      "[db] TLS certificate verification disabled (DATABASE_SSL_NO_VERIFY=true)"
    );
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export function createPrismaClient(databaseUrl: string): PrismaClient {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: resolveSsl(),
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}
