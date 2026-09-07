/**
 * Timeline row model: each event, optionally preceded by a separator.
 *
 * Two kinds of separator (docs/TECH-DEBT.md, item 16):
 * - "page": the URL path changed between consecutive visible events
 * - "reload": the document changed (new page-script instance) but the path
 *   did not, i.e. the page was reloaded. Events from a bfcache restore keep
 *   their documentId and therefore get no separator, which is the truth.
 */

import type { DataLayerEvent } from "@shared/types";

export type TimelineSeparator =
  | { readonly kind: "page"; readonly path: string }
  | { readonly kind: "reload"; readonly path: string };

export interface TimelineRow {
  readonly event: DataLayerEvent;
  readonly deltaMs: number | null;
  readonly separator: TimelineSeparator | null;
}

/**
 * Display path for an event URL ("/checkout/payment?step=2")
 */
export function getPagePath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

/**
 * Milliseconds between each event and the previous one in the FULL stream
 * (not the filtered view), so deltas stay truthful when filters hide events.
 */
export function computeDeltas(
  allEvents: readonly DataLayerEvent[]
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (let i = 1; i < allEvents.length; i++) {
    const current = allEvents[i];
    const previous = allEvents[i - 1];
    if (current && previous) {
      deltas.set(current.id, current.timestamp - previous.timestamp);
    }
  }
  return deltas;
}

export function buildTimelineRows(
  events: readonly DataLayerEvent[],
  deltaByEventId: ReadonlyMap<string, number>
): TimelineRow[] {
  const rows: TimelineRow[] = [];
  let previousPath: string | null = null;
  let previousDocumentId: string | null | undefined;

  for (const event of events) {
    const path = getPagePath(event.url);
    let separator: TimelineSeparator | null = null;

    if (previousPath !== null) {
      if (path !== previousPath) {
        separator = { kind: "page", path };
      } else if (
        event.documentId !== undefined &&
        previousDocumentId !== undefined &&
        event.documentId !== previousDocumentId
      ) {
        separator = { kind: "reload", path };
      }
    }

    rows.push({
      event,
      deltaMs: deltaByEventId.get(event.id) ?? null,
      separator,
    });
    previousPath = path;
    previousDocumentId = event.documentId;
  }

  return rows;
}
