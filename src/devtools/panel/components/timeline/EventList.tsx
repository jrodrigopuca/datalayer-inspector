/**
 * EventList component - simple scrollable list of events
 *
 * Note: Virtualization removed for simplicity. React handles hundreds
 * of items fine. Can add virtualization later if needed for 1000+ events.
 */

import { useRef, useEffect } from "react";
import { useFilteredEvents, useEventSelection, useValidation, useSchemas } from "../../hooks";
import { usePanelStore } from "../../store";
import { EmptyIcon } from "../common";
import { EventItem } from "./EventItem";

export function EventList() {
  const events = useFilteredEvents();
  const { selectedEventId, selectEvent } = useEventSelection();
  const autoScroll = usePanelStore((s) => s.autoScroll);
  const showSchemaEditor = usePanelStore((s) => s.showSchemaEditor);
  const { getValidation } = useValidation();
  const { createSchemaFromEvent } = useSchemas();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
        <p className="text-sm font-medium text-gray-400">No events captured yet</p>
        <p className="text-xs mt-1 text-center leading-relaxed">
          Navigate to a page with GTM installed.<br />
          Events will appear when <code className="text-brand-primary/80 bg-panel-surface px-1 rounded">dataLayer.push()</code> is called.
        </p>
        <div className="mt-4 text-2xs text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Recording active
          </span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      {events.map((event) => (
        <EventItem
          key={event.id}
          event={event}
          isSelected={event.id === selectedEventId}
          onClick={() => selectEvent(event.id)}
          onCreateSchema={() => {
            const schema = createSchemaFromEvent(event);
            showSchemaEditor(schema.id);
          }}
          validation={getValidation(event.id)}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
