/**
 * Selectors for derived state
 *
 * These compute values from store state without modifying it
 */

import type { DataLayerEvent } from "@shared/types";
import { EVENT_CATEGORY, getEventCategory } from "@shared/utils";

import type { PanelStore } from "./index";

/** Filter value for events that failed schema validation */
export const VALIDATION_FAILED_FILTER = "failed";

/**
 * Cache for stringified event data (for search)
 * WeakMap ensures entries are garbage collected when event objects are removed
 */
const eventDataStringCache = new WeakMap<DataLayerEvent, string>();

/**
 * Get cached stringified event data for search
 */
function getEventDataString(event: DataLayerEvent): string {
  let cached = eventDataStringCache.get(event);
  if (cached === undefined) {
    cached = JSON.stringify(event.data).toLowerCase();
    eventDataStringCache.set(event, cached);
  }
  return cached;
}

/**
 * Get selected event by ID
 */
export function selectSelectedEvent(state: PanelStore): DataLayerEvent | null {
  if (!state.selectedEventId) return null;
  return state.events.find((e) => e.id === state.selectedEventId) ?? null;
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
      if (state.activeFilter === VALIDATION_FAILED_FILTER) {
        return state.validations.get(event.id)?.status === "fail";
      }
      return getEventCategory(event.eventName) === state.activeFilter;
    });
  }

  // Apply search query
  if (state.searchQuery.trim()) {
    const query = state.searchQuery.toLowerCase();
    filtered = filtered.filter((event) => {
      // Search in event name
      if (event.eventName?.toLowerCase().includes(query)) return true;
      // Search in data (use cached stringify for deep search)
      return getEventDataString(event).includes(query);
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
  engagement: number;
  error: number;
  custom: number;
} {
  const counts = { gtm: 0, ecommerce: 0, engagement: 0, error: 0, custom: 0 };

  for (const event of state.events) {
    counts[getEventCategory(event.eventName)]++;
  }

  return {
    total: state.events.length,
    ...counts,
  };
}

/**
 * Get validation summary (pass/fail counts across validated events)
 */
export function selectValidationSummary(state: PanelStore): {
  passed: number;
  failed: number;
  hasSchemas: boolean;
} {
  let passed = 0;
  let failed = 0;

  for (const validation of state.validations.values()) {
    if (validation.status === "pass") passed++;
    else if (validation.status === "fail") failed++;
  }

  return {
    passed,
    failed,
    hasSchemas: state.schemas.some((s) => s.enabled),
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

// Re-exported so UI code can build category filters without importing shared internals
export { EVENT_CATEGORY };
