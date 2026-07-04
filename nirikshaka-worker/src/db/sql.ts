import { readFileSync } from "node:fs";
import { Pool, type PoolConfig } from "pg";
import type { Queryable } from "../agents/scout/types";

/** Direct pg Pool for raw-SQL hot paths (miners), mirroring client.ts TLS. */
function resolveSsl(): PoolConfig["ssl"] {
  const caPath = process.env.DATABASE_CA_CERT;
  if (caPath) return { ca: readFileSync(caPath, "utf8") };
  if (process.env.DATABASE_SSL_NO_VERIFY === "true") {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export function createSqlPool(databaseUrl: string): Pool {
  return new Pool({ connectionString: databaseUrl, ssl: resolveSsl() });
}

/** Adapt a pg Pool to the miners' minimal Queryable surface. */
export function asQueryable(pool: Pool): Queryable {
  return {
    async query(text, values) {
      const result = await pool.query(text, values);
      return { rows: result.rows };
    },
  };
}
