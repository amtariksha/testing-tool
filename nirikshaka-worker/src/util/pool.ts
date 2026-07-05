/**
 * Bounded-concurrency promise pool (doc §7 Phase 4). Runs items through fn
 * with at most `limit` in flight; a rejection is captured per-item (result
 * null) so one failure never aborts siblings. Pure structural utility —
 * unit-tested for the in-flight bound and rejection isolation.
 */
export async function runPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<Array<R | null>> {
  const results: Array<R | null> = new Array(items.length).fill(null);
  let next = 0;
  const size = Math.max(1, Math.min(limit, items.length || 1));

  async function worker(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      try {
        results[index] = await fn(items[index]!, index);
      } catch {
        results[index] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: size }, () => worker()));
  return results;
}
