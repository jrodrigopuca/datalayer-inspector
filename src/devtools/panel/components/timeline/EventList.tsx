/**
 * EventList component - simple scrollable list of events
 *
 * Note: Virtualization removed for simplicity. React handles hundreds
 * of items fine. Can add virtualization later if needed for 1000+ events.
 */

import { useRef, useEffect } from "react";
import { useFilteredEvents, useEventSelection } from "../../hooks";
import { usePanelStore } from "../../store";
import { EventItem } from "./EventItem";

export function EventList() {
  const events = useFilteredEvents();
  const { selectedEventId, selectEvent } = useEventSelection();
  const autoScroll = usePanelStore((s) => s.autoScroll);
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
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <EmptyIcon className="w-12 h-12 mb-2 opacity-50" />
        <p className="text-sm">No events captured</p>
        <p className="text-xs mt-1">
          Events will appear here when dataLayer.push() is called
        </p>
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
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function EmptyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
      />
    </svg>
  );
}
