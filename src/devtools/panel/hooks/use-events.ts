/**
 * useEvents hook - access to events with filtering
 */

import { useShallow } from "zustand/react/shallow";
import { usePanelStore } from "../store";
import { selectFilteredEvents, selectSelectedEvent } from "../store/selectors";
import type { DataLayerEvent, EventId } from "@shared/types";

/**
 * Get all filtered events
 */
export function useFilteredEvents(): readonly DataLayerEvent[] {
  return usePanelStore(useShallow(selectFilteredEvents));
}

/**
 * Get selected event
 */
export function useSelectedEvent(): DataLayerEvent | null {
  return usePanelStore(selectSelectedEvent);
}

/**
 * Get event by ID
 */
export function useEvent(id: EventId): DataLayerEvent | undefined {
  return usePanelStore((state) => state.events.find((e) => e.id === id));
}

/**
 * Event selection actions
 */
export function useEventSelection(): {
  selectedEventId: EventId | null;
  selectEvent: (id: EventId | null) => void;
  selectNext: () => void;
  selectPrevious: () => void;
} {
  const selectedEventId = usePanelStore((s) => s.selectedEventId);
  const selectEvent = usePanelStore((s) => s.selectEvent);
  const events = usePanelStore((s) => s.events);

  function selectNext(): void {
    const currentIndex = events.findIndex((e) => e.id === selectedEventId);
    const nextIndex = Math.min(currentIndex + 1, events.length - 1);
    if (nextIndex >= 0 && events[nextIndex]) {
      selectEvent(events[nextIndex].id);
    }
  }

  function selectPrevious(): void {
    const currentIndex = events.findIndex((e) => e.id === selectedEventId);
    const prevIndex = Math.max(currentIndex - 1, 0);
    if (events[prevIndex]) {
      selectEvent(events[prevIndex].id);
    }
  }

  return {
    selectedEventId,
    selectEvent,
    selectNext,
    selectPrevious,
  };
}
