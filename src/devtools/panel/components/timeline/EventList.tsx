/**
 * EventList component - simple scrollable list of events
 *
 * Renders the timeline with page-navigation separators so multi-page
 * flows (e.g. checkout funnels) read as a narrative, not a flat log.
 *
 * Note: Virtualization removed for simplicity. React handles hundreds
 * of items fine. Can add virtualization later if needed for 1000+ events.
 */

import type { DataLayerEvent } from "@shared/types";
import { useEffect, useMemo, useRef } from "react";
import {
  useEventSelection,
  useFilteredEvents,
  useSchemas,
  useValidation,
} from "../../hooks";
import { usePanelStore } from "../../store";
import { EmptyIcon } from "../common";
import { EventItem } from "./EventItem";

/**
 * Extract a display path from an event URL ("/checkout/payment")
 */
function getPagePath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname + parsed.search;
  } catch {
    return url;
  }
}

/** Row model: an event, optionally preceded by a page separator */
interface TimelineRow {
  event: DataLayerEvent;
  deltaMs: number | null;
  pageBreak: string | null;
}

export function EventList() {
  const events = useFilteredEvents();
  const allEvents = usePanelStore((s) => s.events);
  const isRecording = usePanelStore((s) => s.isRecording);
  const { selectedEventId, selectEvent } = useEventSelection();
  const autoScroll = usePanelStore((s) => s.settings.autoScroll);
  const showSchemaEditor = usePanelStore((s) => s.showSchemaEditor);
  const { getValidation } = useValidation();
  const { createSchemaFromEvent } = useSchemas();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Time deltas are computed against the FULL event stream (not the
  // filtered view) so they stay truthful when filters hide events.
  const deltaByEventId = useMemo(() => {
    const deltas = new Map<string, number>();
    for (let i = 1; i < allEvents.length; i++) {
      const current = allEvents[i];
      const previous = allEvents[i - 1];
      if (current && previous) {
        deltas.set(current.id, current.timestamp - previous.timestamp);
      }
    }
    return deltas;
  }, [allEvents]);

  // Insert a page separator whenever the URL path changes between
  // consecutive visible events.
  const rows = useMemo<TimelineRow[]>(() => {
    const result: TimelineRow[] = [];
    let previousPath: string | null = null;

    for (const event of events) {
      const path = getPagePath(event.url);
      result.push({
        event,
        deltaMs: deltaByEventId.get(event.id) ?? null,
        pageBreak: previousPath !== null && path !== previousPath ? path : null,
      });
      previousPath = path;
    }

    return result;
  }, [events, deltaByEventId]);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events.length, autoScroll]);

  // Scroll selected event into view
  useEffect(() => {
    if (!selectedEventId) return;

    const selectedElement = document.querySelector(
      `[data-event-id="${selectedEventId}"]`
    );
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [selectedEventId]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4">
        <EmptyIcon className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm font-medium text-gray-400">
          No events captured yet
        </p>
        <p className="text-xs mt-1 text-center leading-relaxed">
          Navigate to a page with GTM installed.
          <br />
          Events will appear when{" "}
          <code className="text-brand-primary/80 bg-panel-surface px-1 rounded">
            dataLayer.push()
          </code>{" "}
          is called.
        </p>
        <div className="mt-4 text-2xs text-gray-600">
          {isRecording ? (
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Recording active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              Recording paused — press Record to capture
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      {rows.map(({ event, deltaMs, pageBreak }) => (
        <div key={event.id}>
          {pageBreak !== null && <PageSeparator path={pageBreak} />}
          <EventItem
            event={event}
            deltaMs={deltaMs}
            isSelected={event.id === selectedEventId}
            onClick={() => selectEvent(event.id)}
            onCreateSchema={() => {
              const schema = createSchemaFromEvent(event);
              showSchemaEditor(schema.id);
            }}
            validation={getValidation(event.id)}
          />
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

/** Visual divider marking a page navigation in the timeline */
function PageSeparator({ path }: { path: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-2xs text-gray-500 bg-panel-surface/60 border-y border-panel-border/60">
      <span aria-hidden="true">↳</span>
      <span className="font-mono truncate" title={path}>
        {path}
      </span>
    </div>
  );
}
