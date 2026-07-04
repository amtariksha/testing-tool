import type { Queryable, ModelFragment, ApiCallRow } from "./types";
import type { ApiChain } from "../../schema/app-model";

/**
 * ApiChainMiner — endpoint co-occurrence + ordering chains
 * (implementation doc §4.1 L3). Sessionizes api_call events by journey and
 * emits the ordered endpoint sequences; buildApiChainFragment (pure) rolls
 * repeated sequences into supported chains and is unit tested without a DB.
 */

export interface ApiChainMinerOptions {
  sinceDays?: number;
  minSupport?: number;
  maxChainLength?: number;
}

const DEFAULTS: Required<ApiChainMinerOptions> = {
  sinceDays: 30,
  minSupport: 2,
  maxChainLength: 6,
};

// api_call events carry method/path in data; normalize to "METHOD /path".
// Sessionized by journey; ordered by timestamp. Endpoint expression coalesces
// common shapes so telemetry variations still group.
const API_CALLS_SQL = `
  SELECT j.id AS session_key,
         upper(coalesce(e.data->>'method', 'GET')) || ' ' ||
           coalesce(e.data->>'path', e.data->>'url', e.name) AS endpoint,
         row_number() OVER (PARTITION BY j.id ORDER BY e.timestamp)::int AS seq
  FROM journey_events e
  JOIN user_journeys j ON e."journeyId" = j.id
  WHERE j."projectId" = $1
    AND e.type = 'api_call'
    AND e.timestamp >= now() - make_interval(days => $2)
    AND coalesce(e.data->>'path', e.data->>'url', e.name) IS NOT NULL
  ORDER BY j.id, seq;
`;

/** Pure: roll ordered per-session endpoint rows into supported chains. */
export function buildApiChainFragment(
  rows: ApiCallRow[],
  options: ApiChainMinerOptions = {}
): ModelFragment {
  const opts = { ...DEFAULTS, ...options };

  const sessions = new Map<string, ApiCallRow[]>();
  for (const row of rows) {
    const list = sessions.get(row.session_key) ?? [];
    list.push(row);
    sessions.set(row.session_key, list);
  }

  // Count identical ordered endpoint sequences (capped length) across sessions.
  const chainCounts = new Map<string, { chain: string[]; support: number }>();
  for (const events of sessions.values()) {
    const ordered = events
      .slice()
      .sort((a, b) => a.seq - b.seq)
      .map((e) => e.endpoint)
      .slice(0, opts.maxChainLength);
    if (ordered.length < 2) continue;
    const key = ordered.join(" -> ");
    const existing = chainCounts.get(key);
    if (existing) existing.support += 1;
    else chainCounts.set(key, { chain: ordered, support: 1 });
  }

  const apiChains: ApiChain[] = [...chainCounts.values()]
    .filter((c) => c.support >= opts.minSupport)
    .sort((a, b) => b.support - a.support);

  const evidence: ModelFragment["evidence"] = {};
  apiChains.forEach((c, index) => {
    evidence[`apiChain:${index}`] = [
      { source: "telemetry", ref: c.chain.join(" -> "), confidence: 1 },
    ];
  });

  return { apiChains, evidence };
}

export async function mineApiChains(
  db: Queryable,
  projectId: string,
  options: ApiChainMinerOptions = {}
): Promise<ModelFragment> {
  const opts = { ...DEFAULTS, ...options };
  const result = await db.query<ApiCallRow>(API_CALLS_SQL, [
    projectId,
    opts.sinceDays,
  ]);
  return buildApiChainFragment(result.rows, options);
}
