/**
 * EventList component - virtualized list of events
 *
 * Uses a simple virtualization approach without external libraries
 * to keep bundle size small.
 */

import { useRef, useEffect, useState } from "react";
import { useFilteredEvents, useEventSelection } from "../../hooks";
import { usePanelStore } from "../../store";
import { EventItem } from "./EventItem";

const ITEM_HEIGHT = 48; // Fixed height for virtualization
const OVERSCAN = 5; // Extra items to render above/below viewport

export function EventList() {
  const events = useFilteredEvents();
  const { selectedEventId, selectEvent } = useEventSelection();
  const autoScroll = usePanelStore((s) => s.autoScroll);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Calculate visible range
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    events.length,
    Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN
  );

  const visibleEvents = events.slice(startIndex, endIndex);
  const totalHeight = events.length * ITEM_HEIGHT;
  const offsetY = startIndex * ITEM_HEIGHT;

  // Handle scroll
  function handleScroll(): void {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }

  // Update container height on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    observer.observe(container);
    setContainerHeight(container.clientHeight);

    return () => observer.disconnect();
  }, []);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && containerRef.current && events.length > 0) {
      containerRef.current.scrollTop = totalHeight;
    }
  }, [events.length, autoScroll, totalHeight]);

  // Scroll selected event into view
  useEffect(() => {
    if (!selectedEventId || !containerRef.current) return;

    const selectedIndex = events.findIndex((e) => e.id === selectedEventId);
    if (selectedIndex === -1) return;

    const itemTop = selectedIndex * ITEM_HEIGHT;
    const itemBottom = itemTop + ITEM_HEIGHT;
    const viewTop = containerRef.current.scrollTop;
    const viewBottom = viewTop + containerHeight;

    if (itemTop < viewTop) {
      containerRef.current.scrollTop = itemTop;
    } else if (itemBottom > viewBottom) {
      containerRef.current.scrollTop = itemBottom - containerHeight;
    }
  }, [selectedEventId, events, containerHeight]);

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
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-full overflow-auto"
    >
      {/* Spacer for virtualization */}
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: offsetY,
            left: 0,
            right: 0,
          }}
        >
          {visibleEvents.map((event) => (
            <EventItem
              key={event.id}
              event={event}
              isSelected={event.id === selectedEventId}
              onClick={() => selectEvent(event.id)}
            />
          ))}
        </div>
      </div>
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
