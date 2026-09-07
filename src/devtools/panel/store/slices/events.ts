/**
 * Events slice - manages captured dataLayer events
 */

import type { DataLayerEvent, EventId } from "@shared/types";
import { pruneEvents } from "@shared/utils/prune";
import type { StateCreator } from "zustand";
import type { SchemasSlice } from "./schemas";
import type { SettingsSlice } from "./settings";

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

/**
 * The slice reads `settings.maxEventsPerTab` and prunes `validations`,
 * so its creator is typed against the slices it touches.
 */
export const createEventsSlice: StateCreator<
  EventsSlice & SettingsSlice & SchemasSlice,
  [],
  [],
  EventsSlice
> = (set) => ({
  events: [],
  selectedEventId: null,
  containers: [],

  setEvents: (events) => set({ events }),

  addEvent: (event) =>
    set((state) => {
      // Mirror the service worker's window exactly (shared prune rule)
      const { kept, removed } = pruneEvents(
        [...state.events, event],
        state.settings.maxEventsPerTab
      );

      if (removed.length === 0) {
        return { events: kept };
      }

      const validations = new Map(state.validations);
      let selectedEventId = state.selectedEventId;
      for (const dropped of removed) {
        validations.delete(dropped.id);
        if (dropped.id === selectedEventId) {
          selectedEventId = null;
        }
      }

      return { events: kept, validations, selectedEventId };
    }),

  clearEvents: () =>
    set({
      events: [],
      selectedEventId: null,
    }),

  selectEvent: (id) => set({ selectedEventId: id }),

  setContainers: (containers) => set({ containers }),
});
