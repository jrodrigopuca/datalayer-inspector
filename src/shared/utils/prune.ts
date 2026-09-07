/**
 * Event pruning rule - single source of truth for the per-tab event limit.
 *
 * Used by the service worker (authoritative store) AND the DevTools panel
 * (local mirror) so both sides keep exactly the same window of events.
 * If the two ever disagree, the panel shows events the worker already
 * discarded and every push recomputes over an unbounded history.
 *
 * Prunes below the limit with some slack so callers don't splice on every
 * single push once the limit is reached.
 */

/** Maximum number of events removed beyond the limit in one prune */
const MAX_SLACK = 100;

/**
 * How many extra events to drop below the limit when pruning
 */
export function pruneSlack(limit: number): number {
  return Math.min(MAX_SLACK, Math.floor(limit / 5));
}

/**
 * Number of oldest events to drop so that `length` fits within `limit`
 *
 * @returns 0 when no pruning is needed or the limit is invalid
 */
export function countToPrune(length: number, limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return 0;
  if (length <= limit) return 0;

  const keep = Math.max(1, limit - pruneSlack(limit));
  return Math.max(0, length - keep);
}

/**
 * Immutable prune: returns the events to keep and the ones removed
 */
export function pruneEvents<T>(
  events: readonly T[],
  limit: number
): { kept: readonly T[]; removed: readonly T[] } {
  const toRemove = countToPrune(events.length, limit);
  if (toRemove === 0) {
    return { kept: events, removed: [] };
  }
  return {
    kept: events.slice(toRemove),
    removed: events.slice(0, toRemove),
  };
}
