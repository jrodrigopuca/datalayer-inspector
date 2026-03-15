/**
 * Selectors for derived state
 *
 * These compute values from store state without modifying it
 */

import type { DataLayerEvent } from "@shared/types";
import { EVENT_PATTERNS } from "@shared/constants";

import type { PanelStore } from "./index";

/**
 * Get selected event by ID
 */
export function selectSelectedEvent(state: PanelStore): DataLayerEvent | null {
  if (!state.selectedEventId) return null;
  return (
    state.events.find((e) => e.id === state.selectedEventId) ?? null
  );
}

/**
 * Get filtered events based on search query and active filter
 */
export function selectFilteredEvents(
  state: PanelStore
): readonly DataLayerEvent[] {
  let filtered = state.events;

  // Apply type filter
  if (state.activeFilter) {
    filtered = filtered.filter((event) => {
      const eventName = event.eventName ?? "";
      switch (state.activeFilter) {
        case "gtm":
          return EVENT_PATTERNS.GTM.test(eventName);
        case "ecommerce":
          return EVENT_PATTERNS.ECOMMERCE.test(eventName);
        case "custom":
          return (
            !EVENT_PATTERNS.GTM.test(eventName) &&
            !EVENT_PATTERNS.ECOMMERCE.test(eventName)
          );
        default:
          return true;
      }
    });
  }

  // Apply search query
  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter((event) => {
      // Search in event name
      if (event.eventName?.toLowerCase().includes(query)) return true;
      // Search in data (stringify for deep search)
      const dataString = JSON.stringify(event.data).toLowerCase();
      return dataString.includes(query);
    });
  }

  return filtered;
}

/**
 * Get event counts by category
 */
export function selectEventCounts(state: PanelStore): {
  total: number;
  gtm: number;
  ecommerce: number;
  custom: number;
} {
  let gtm = 0;
  let ecommerce = 0;
  let custom = 0;

  for (const event of state.events) {
    const eventName = event.eventName ?? "";
    if (EVENT_PATTERNS.GTM.test(eventName)) {
      gtm++;
    } else if (EVENT_PATTERNS.ECOMMERCE.test(eventName)) {
      ecommerce++;
    } else {
      custom++;
    }
  }

  return {
    total: state.events.length,
    gtm,
    ecommerce,
    custom,
  };
}

/**
 * Check if there's any data to display
 */
export function selectHasData(state: PanelStore): boolean {
  return state.events.length > 0 || state.containers.length > 0;
}

/**
 * Get connection status info
 */
export function selectConnectionInfo(state: PanelStore): {
  isConnected: boolean;
  isLoading: boolean;
  hasError: boolean;
} {
  return {
    isConnected: state.connectionState === "connected",
    isLoading: state.connectionState === "connecting",
    hasError: state.connectionState === "error",
  };
}
