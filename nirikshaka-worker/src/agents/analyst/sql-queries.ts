import type { Queryable } from "../scout/types";
import type { ObservedTelemetry } from "./staleness";

/**
 * Raw-SQL telemetry rollups for staleness (doc §4.4) over a recent window —
 * same style as the Scout miners. Reads screen_view names, endpoints, and
 * screen→screen transitions from journey events.
 */
export async function observeTelemetry(
  sql: Queryable,
  projectId: string,
  sinceDays: number
): Promise<ObservedTelemetry> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  const screens = await sql.query(
    `SELECT DISTINCT je.name AS name
     FROM journey_events je
     JOIN user_journeys uj ON uj.id = je."journeyId"
     WHERE uj."projectId" = $1 AND je.type = 'screen_view' AND je.timestamp >= $2
     LIMIT 500`,
    [projectId, since]
  );

  const endpoints = await sql.query(
    `SELECT DISTINCT (method || ' ' || path) AS endpoint
     FROM api_requests
     WHERE "projectId" = $1 AND timestamp >= $2
     LIMIT 500`,
    [projectId, since]
  );

  const transitions = await sql.query(
    `SELECT from_screen AS from, to_screen AS to, COUNT(*)::int AS count
     FROM (
       SELECT je.name AS to_screen,
              LAG(je.name) OVER (PARTITION BY je."journeyId" ORDER BY je.timestamp) AS from_screen
       FROM journey_events je
       JOIN user_journeys uj ON uj.id = je."journeyId"
       WHERE uj."projectId" = $1 AND je.type = 'screen_view' AND je.timestamp >= $2
     ) seq
     WHERE from_screen IS NOT NULL AND from_screen <> to_screen
     GROUP BY from_screen, to_screen
     ORDER BY count DESC
     LIMIT 200`,
    [projectId, since]
  );

  return {
    screenNames: screens.rows.map((r) => String((r as { name: string }).name)),
    endpoints: endpoints.rows.map((r) => String((r as { endpoint: string }).endpoint)),
    transitions: transitions.rows.map((r) => {
      const row = r as { from: string; to: string; count: number };
      return { from: row.from, to: row.to, count: Number(row.count) };
    }),
  };
}
