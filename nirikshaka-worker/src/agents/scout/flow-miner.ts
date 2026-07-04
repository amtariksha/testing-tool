import type {
  Queryable,
  ModelFragment,
  TransitionRow,
  ScreenStatRow,
} from "./types";
import type { Screen, Flow } from "../../schema/app-model";

/**
 * FlowMiner — process mining over JourneyEvent screen_view sequences
 * (implementation doc §4.1 L3). Transition counting is done in SQL with a LEAD
 * window function (Pradeep's raw-SQL-on-hot-paths preference); the pure
 * buildFlowFragment assembles the directed-flow-graph fragment and is unit
 * tested without a database.
 */

export interface FlowMinerOptions {
  sinceDays?: number; // only mine events newer than this
  minSupport?: number; // drop transitions/flows below this count
  topTransitionsPerScreen?: number;
}

const DEFAULTS: Required<FlowMinerOptions> = {
  sinceDays: 30,
  minSupport: 2,
  topTransitionsPerScreen: 5,
};

const TRANSITIONS_SQL = `
  WITH screen_events AS (
    SELECT j.id AS journey_id, e.name AS screen, e.timestamp
    FROM journey_events e
    JOIN user_journeys j ON e."journeyId" = j.id
    WHERE j."projectId" = $1
      AND e.type = 'screen_view'
      AND e.name IS NOT NULL AND e.name <> ''
      AND e.timestamp >= now() - make_interval(days => $2)
  ),
  transitions AS (
    SELECT screen AS from_screen,
           LEAD(screen) OVER (PARTITION BY journey_id ORDER BY timestamp) AS to_screen
    FROM screen_events
  )
  SELECT from_screen, to_screen, count(*)::int AS cnt
  FROM transitions
  WHERE to_screen IS NOT NULL AND to_screen <> from_screen
  GROUP BY from_screen, to_screen
  ORDER BY cnt DESC;
`;

const SCREEN_STATS_SQL = `
  SELECT e.name AS screen,
         count(*)::int AS occurrences,
         avg(e.duration)::int AS avg_duration_ms
  FROM journey_events e
  JOIN user_journeys j ON e."journeyId" = j.id
  WHERE j."projectId" = $1
    AND e.type = 'screen_view'
    AND e.name IS NOT NULL AND e.name <> ''
    AND e.timestamp >= now() - make_interval(days => $2)
  GROUP BY e.name;
`;

/** Turn a screen name into a stable slug id (e.g. "New Request" -> "new-request"). */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "screen";
}

/** Pure: assemble the flow-graph fragment from SQL rows. Unit-tested. */
export function buildFlowFragment(
  transitions: TransitionRow[],
  screenStats: ScreenStatRow[],
  options: FlowMinerOptions = {}
): ModelFragment {
  const opts = { ...DEFAULTS, ...options };
  const strong = transitions.filter((t) => t.cnt >= opts.minSupport);

  const byFrom = new Map<string, TransitionRow[]>();
  for (const t of strong) {
    const list = byFrom.get(t.from_screen) ?? [];
    list.push(t);
    byFrom.set(t.from_screen, list);
  }

  const screens: Screen[] = screenStats.map((stat) => {
    const outgoing = (byFrom.get(stat.screen) ?? [])
      .slice()
      .sort((a, b) => b.cnt - a.cnt)
      .slice(0, opts.topTransitionsPerScreen)
      .map((t) => ({ to: slugify(t.to_screen), count: t.cnt }));
    return {
      id: slugify(stat.screen),
      observedNames: [stat.screen],
      avgDurationMs: stat.avg_duration_ms,
      topTransitions: outgoing,
    };
  });

  const totalOut = new Map<string, number>();
  for (const t of strong) {
    totalOut.set(t.from_screen, (totalOut.get(t.from_screen) ?? 0) + t.cnt);
  }

  // Each strong edge becomes a 2-step flow; confidence = edge share of the
  // source screen's outgoing traffic. Multi-step path mining lands in Track B
  // once real telemetry exists.
  const flows: Flow[] = strong
    .sort((a, b) => b.cnt - a.cnt)
    .map((t) => {
      const from = slugify(t.from_screen);
      const to = slugify(t.to_screen);
      const denom = totalOut.get(t.from_screen) ?? t.cnt;
      return {
        id: `${from}--${to}`,
        featureId: null,
        steps: [from, to],
        support: t.cnt,
        confidence: denom > 0 ? Number((t.cnt / denom).toFixed(2)) : 0,
        source: "telemetry",
      };
    });

  const evidence: ModelFragment["evidence"] = {};
  for (const flow of flows) {
    evidence[`flow:${flow.id}`] = [
      { source: "telemetry", ref: `transition:${flow.id}`, confidence: flow.confidence },
    ];
  }
  for (const screen of screens) {
    evidence[`screen:${screen.id}`] = [
      { source: "telemetry", ref: `screen_view:${screen.observedNames[0]}`, confidence: 1 },
    ];
  }

  return { screens, flows, evidence };
}

/** Run the miner against a live database. */
export async function mineFlows(
  db: Queryable,
  projectId: string,
  options: FlowMinerOptions = {}
): Promise<ModelFragment> {
  const opts = { ...DEFAULTS, ...options };
  const [transitions, stats] = await Promise.all([
    db.query<TransitionRow>(TRANSITIONS_SQL, [projectId, opts.sinceDays]),
    db.query<ScreenStatRow>(SCREEN_STATS_SQL, [projectId, opts.sinceDays]),
  ]);
  return buildFlowFragment(transitions.rows, stats.rows, options);
}
