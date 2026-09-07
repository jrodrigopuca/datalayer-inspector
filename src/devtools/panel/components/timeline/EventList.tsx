/**
 * EventList component - simple scrollable list of events
 *
 * Renders the timeline with page-navigation separators so multi-page
 * flows (e.g. checkout funnels) read as a narrative, not a flat log.
 *
 * Note: Virtualization removed for simplicity. React handles hundreds
 * of items fine. Can add virtualization later if needed for 1000+ events.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCommands,
  useEventSelection,
  useFilteredEvents,
  useSchemas,
  useValidation,
} from "../../hooks";
import { buildTimelineRows, computeDeltas } from "../../lib/timeline-rows";
import { usePanelStore } from "../../store";
import { ConfirmDialog, EmptyIcon } from "../common";
import { EventItem } from "./EventItem";

export function EventList() {
  const events = useFilteredEvents();
  const allEvents = usePanelStore((s) => s.events);
  const isRecording = usePanelStore((s) => s.isRecording);
  const isEnabled = usePanelStore((s) => s.settings.enabled);
  const limitReached = usePanelStore((s) => s.limitReached);
  const maxEvents = usePanelStore((s) => s.settings.maxEventsPerTab);
  const { toggleEnabled, clearEvents } = useCommands();
  const { selectedEventId, selectEvent } = useEventSelection();
  const autoScroll = usePanelStore((s) => s.settings.autoScroll);
  const showSchemaEditor = usePanelStore((s) => s.showSchemaEditor);
  const { getValidation } = useValidation();
  const { createSchemaFromEvent } = useSchemas();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const deltaByEventId = useMemo(() => computeDeltas(allEvents), [allEvents]);
  const rows = useMemo(
    () => buildTimelineRows(events, deltaByEventId),
    [events, deltaByEventId]
  );

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

  if (events.length === 0 && !isEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 px-4">
        <EmptyIcon className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm font-medium text-gray-400">Capture is off</p>
        <p className="text-xs mt-1 text-center leading-relaxed">
          Strata starts off so it never runs when you are not debugging.
          <br />
          Turn it on to capture this page's dataLayer, including what was pushed
          before now.
        </p>
        <button
          type="button"
          onClick={() => void toggleEnabled()}
          className="mt-4 px-3 py-1.5 text-sm rounded bg-brand-primary text-white hover:opacity-90 transition-opacity"
        >
          Turn on capture
        </button>
      </div>
    );
  }

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
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Recording this tab
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-500" />
              Timeline paused — press Resume to continue
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      {!isEnabled && (
        <div className="sticky top-0 z-10 flex items-center gap-3 px-3 py-2 text-xs bg-panel-surface border-b border-panel-border border-l-4 border-l-gray-500 text-gray-300">
          <span className="flex-1">
            Capture is off. These events are from before; new pushes are not
            being recorded.
          </span>
          <button
            type="button"
            onClick={() => void toggleEnabled()}
            className="px-2 py-1 rounded bg-brand-primary text-white hover:opacity-90 transition-opacity"
          >
            Turn on
          </button>
        </div>
      )}
      {limitReached && (
        <div className="sticky top-0 z-10 flex items-center gap-3 px-3 py-2 text-xs bg-panel-surface border-b border-panel-border border-l-4 border-l-event-error text-event-error">
          <span className="flex-1">
            Event limit reached ({maxEvents}). Capture is paused until you
            clear.
          </span>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="px-2 py-1 rounded bg-event-error text-white hover:opacity-90 transition-opacity"
          >
            Clear events
          </button>
        </div>
      )}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear All Events"
        message={`This removes all ${allEvents.length} captured events and resumes capture. Export them first if you need them.`}
        confirmText="Clear"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          setShowClearConfirm(false);
          void clearEvents();
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
      {rows.map(({ event, deltaMs, separator }) => (
        <div key={event.id}>
          {separator?.kind === "page" && (
            <PageSeparator path={separator.path} />
          )}
          {separator?.kind === "reload" && (
            <ReloadSeparator path={separator.path} />
          )}
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

/** Visual divider marking a reload of the same page */
function ReloadSeparator({ path }: { path: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-2xs text-gray-500 bg-panel-surface/60 border-y border-panel-border/60">
      <span aria-hidden="true">↻</span>
      <span>Page reloaded</span>
      <span className="font-mono truncate opacity-70" title={path}>
        {path}
      </span>
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
