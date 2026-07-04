import type { Queryable } from "../scout/types";

/**
 * Raw-SQL telemetry reads for the Truth Check (doc §5.4) and the MCP
 * check_backend tool. Deliberately selects ONLY plaintext columns —
 * requestBody/responseBody are envelope-encrypted and never needed here.
 * All queries ride the existing (projectId, timestamp) indexes.
 */

export interface ApiRow {
  id: string;
  method: string;
  path: string;
  status: number;
  timestamp: Date;
}

export interface CrashRow {
  id: string;
  severity: string;
  sessionId: string;
  timestamp: Date;
}

export interface UiErrorRow {
  id: string;
  type: string;
  component: string;
  message: string;
  timestamp: Date;
}

export async function find5xx(
  sql: Queryable,
  projectId: string,
  from: Date,
  to: Date
): Promise<ApiRow[]> {
  const { rows } = await sql.query(
    `SELECT id, method, path, status, timestamp
     FROM api_requests
     WHERE "projectId" = $1 AND timestamp >= $2 AND timestamp <= $3 AND status >= 500
     ORDER BY timestamp ASC
     LIMIT 50`,
    [projectId, from, to]
  );
  return rows as unknown as ApiRow[];
}

/** Latest request in the window matching path_contains (+ optional method). */
export async function findMatchingRequest(
  sql: Queryable,
  projectId: string,
  from: Date,
  to: Date,
  expect: { path_contains: string; method?: string }
): Promise<ApiRow | null> {
  const params: unknown[] = [projectId, from, to, `%${expect.path_contains}%`];
  let methodClause = "";
  if (expect.method) {
    params.push(expect.method.toUpperCase());
    methodClause = `AND UPPER(method) = $${params.length}`;
  }
  const { rows } = await sql.query(
    `SELECT id, method, path, status, timestamp
     FROM api_requests
     WHERE "projectId" = $1 AND timestamp >= $2 AND timestamp <= $3
       AND path LIKE $4 ${methodClause}
     ORDER BY timestamp DESC
     LIMIT 1`,
    params
  );
  return (rows[0] as unknown as ApiRow | undefined) ?? null;
}

export async function findCrashes(
  sql: Queryable,
  projectId: string,
  from: Date,
  to: Date
): Promise<CrashRow[]> {
  const { rows } = await sql.query(
    `SELECT id, severity, "sessionId", timestamp
     FROM crash_logs
     WHERE "projectId" = $1 AND timestamp >= $2 AND timestamp <= $3
     ORDER BY timestamp ASC
     LIMIT 50`,
    [projectId, from, to]
  );
  return rows as unknown as CrashRow[];
}

export async function findUiErrors(
  sql: Queryable,
  projectId: string,
  from: Date,
  to: Date
): Promise<UiErrorRow[]> {
  const { rows } = await sql.query(
    `SELECT id, type, component, message, timestamp
     FROM ui_errors
     WHERE "projectId" = $1 AND timestamp >= $2 AND timestamp <= $3
     ORDER BY timestamp ASC
     LIMIT 50`,
    [projectId, from, to]
  );
  return rows as unknown as UiErrorRow[];
}
