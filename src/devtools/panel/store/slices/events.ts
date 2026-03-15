/**
 * Events slice - manages captured dataLayer events
 */

import type { StateCreator } from "zustand";
import type { DataLayerEvent, EventId } from "@shared/types";

export interface EventsSlice {
  /** All captured events for current tab */
  events: readonly DataLayerEvent[];
  /** Currently selected event ID */
  selectedEventId: EventId | null;
  /** Containers detected in current tab */
  containers: readonly string[];

  // Actions
  setEvents: (events: readonly DataLayerEvent[]) => void;
  addEvent: (event: DataLayerEvent) => void;
  clearEvents: () => void;
  selectEvent: (id: EventId | null) => void;
  setContainers: (containers: readonly string[]) => void;
}

export const createEventsSlice: StateCreator<EventsSlice, [], [], EventsSlice> =
  (set) => ({
    events: [],
    selectedEventId: null,
    containers: [],

    setEvents: (events) => set({ events }),

    addEvent: (event) =>
      set((state) => ({
        events: [...state.events, event],
      })),

    clearEvents: () =>
      set({
        events: [],
        selectedEventId: null,
      }),

    selectEvent: (id) => set({ selectedEventId: id }),

    setContainers: (containers) => set({ containers }),
  });
