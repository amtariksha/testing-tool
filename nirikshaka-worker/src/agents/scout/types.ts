import type {
  Feature,
  Screen,
  Flow,
  ApiChain,
  Role,
  Entity,
  EvidenceIndex,
} from "../../schema/app-model";

export type { Role, Entity } from "../../schema/app-model";

/** Minimal query surface satisfied by pg.Pool and pg.PoolClient. */
export interface Queryable {
  query<R = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: R[] }>;
}

/** A miner produces a partial app model plus the evidence backing its claims. */
export interface ModelFragment {
  features?: Feature[];
  screens?: Screen[];
  flows?: Flow[];
  apiChains?: ApiChain[];
  roles?: Role[];
  entities?: Entity[];
  evidence: EvidenceIndex;
}

/** Raw rows returned by the flow-miner SQL. */
export interface TransitionRow {
  from_screen: string;
  to_screen: string;
  cnt: number;
}

export interface ScreenStatRow {
  screen: string;
  occurrences: number;
  avg_duration_ms: number | null;
}

/** Raw rows returned by the api-chain-miner SQL: one ordered endpoint per row. */
export interface ApiCallRow {
  session_key: string;
  endpoint: string;
  seq: number;
}
