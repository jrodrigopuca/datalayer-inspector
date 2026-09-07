/**
 * Events slice - mirrors the service worker's events for the current tab
 *
 * The worker enforces a HARD per-tab limit and never sends more than it
 * stores, so this slice only appends; `limitReached` mirrors the worker's
 * flag so the UI can ask the user to clear (docs/TECH-DEBT.md, item 16).
 */

import type { DataLayerEvent, EventId } from "@shared/types";
import type { StateCreator } from "zustand";

export interface EventsSlice {
  /** All captured events for current tab */
  events: readonly DataLayerEvent[];
  /** Currently selected event ID */
  selectedEventId: EventId | null;
  /** Containers detected in current tab */
  containers: readonly string[];
  /** Capture stopped at the limit; Clear resumes it */
  limitReached: boolean;

  // Actions
  setEvents: (events: readonly DataLayerEvent[]) => void;
  addEvent: (event: DataLayerEvent) => void;
  clearEvents: () => void;
  selectEvent: (id: EventId | null) => void;
  setContainers: (containers: readonly string[]) => void;
  setLimitReached: (limitReached: boolean) => void;
}

export const createEventsSlice: StateCreator<
  EventsSlice,
  [],
  [],
  EventsSlice
> = (set) => ({
  events: [],
  selectedEventId: null,
  containers: [],
  limitReached: false,

  setEvents: (events) => set({ events }),

  addEvent: (event) =>
    set((state) => ({
      events: [...state.events, event],
    })),

  clearEvents: () =>
    set({
      events: [],
      selectedEventId: null,
      limitReached: false,
    }),

  selectEvent: (id) => set({ selectedEventId: id }),

  setContainers: (containers) => set({ containers }),

  setLimitReached: (limitReached) => set({ limitReached }),
});
