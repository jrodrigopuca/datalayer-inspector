/**
 * Service Worker - Tab State Manager
 *
 * Manages per-tab state including events, containers, and recording status.
 * Acts as single source of truth for tab data.
 */

import {
  createInitialTabState,
  type MutableTabState,
  type DataLayerEvent,
} from "@shared/types";
import { LIMITS } from "@shared/constants";

/**
 * In-memory storage of tab states
 * Map<tabId, TabState>
 */
const tabStates = new Map<number, MutableTabState>();

/**
 * Get state for a tab, creating if needed
 */
export function getOrCreateTabState(
  tabId: number,
  url: string = ""
): MutableTabState {
  let state = tabStates.get(tabId);

  if (!state) {
    state = createInitialTabState(tabId, url);
    tabStates.set(tabId, state);
  }

  return state;
}

/**
 * Get state for a tab (returns undefined if not exists)
 */
export function getTabState(tabId: number): MutableTabState | undefined {
  return tabStates.get(tabId);
}

/**
 * Check if tab state exists
 */
export function hasTabState(tabId: number): boolean {
  return tabStates.has(tabId);
}

/**
 * Add event to tab state
 *
 * @returns The event with assigned index, or null if recording is paused
 */
export function addEvent(
  tabId: number,
  event: Omit<DataLayerEvent, "index"> & { index?: number }
): DataLayerEvent | null {
  const state = getOrCreateTabState(tabId);

  // Skip if not recording
  if (!state.isRecording) {
    return null;
  }

  // Assign index from tab state
  const fullEvent: DataLayerEvent = {
    ...event,
    index: state.nextIndex,
  };

  state.nextIndex++;
  state.events.push(fullEvent);

  // Update URL if different
  if (event.url && event.url !== state.url) {
    state.url = event.url;
  }

  // Prune old events if over limit
  pruneEventsIfNeeded(state);

  return fullEvent;
}

/**
 * Add or update containers for a tab
 */
export function updateContainers(tabId: number, containerIds: string[]): void {
  const state = getOrCreateTabState(tabId);

  // Merge with existing (no duplicates)
  const existing = new Set(state.containers);
  for (const id of containerIds) {
    existing.add(id);
  }

  state.containers = [...existing];
}

/**
 * Set recording state for a tab
 */
export function setRecording(tabId: number, isRecording: boolean): void {
  const state = getOrCreateTabState(tabId);
  state.isRecording = isRecording;
}

/**
 * Clear events for a tab (keeps containers and recording state)
 */
export function clearEvents(tabId: number): void {
  const state = tabStates.get(tabId);
  if (state) {
    state.events = [];
    state.nextIndex = 1;
  }
}

/**
 * Reset tab state completely (for navigation)
 */
export function resetTabState(tabId: number, newUrl: string = ""): void {
  const state = tabStates.get(tabId);
  if (state) {
    state.events = [];
    state.containers = [];
    state.url = newUrl;
    state.nextIndex = 1;
    // Keep isRecording as-is
  }
}

/**
 * Update tab URL without clearing events (for same-origin navigation)
 */
export function updateTabUrl(tabId: number, newUrl: string): void {
  const state = tabStates.get(tabId);
  if (state) {
    state.url = newUrl;
  }
}

/**
 * Remove tab state entirely (for tab close)
 */
export function removeTabState(tabId: number): boolean {
  return tabStates.delete(tabId);
}

/**
 * Get all tab IDs with state
 */
export function getAllTabIds(): number[] {
  return [...tabStates.keys()];
}

/**
 * Get events for a tab
 */
export function getEvents(tabId: number): readonly DataLayerEvent[] {
  const state = tabStates.get(tabId);
  return state?.events ?? [];
}

/**
 * Get containers for a tab
 */
export function getContainers(tabId: number): readonly string[] {
  const state = tabStates.get(tabId);
  return state?.containers ?? [];
}

/**
 * Prune old events if over limit
 */
function pruneEventsIfNeeded(state: MutableTabState): void {
  if (state.events.length > LIMITS.MAX_EVENTS_PER_TAB) {
    // Keep only the most recent events
    const toRemove = state.events.length - LIMITS.MIN_EVENTS_AFTER_PRUNE;
    state.events.splice(0, toRemove);
  }
}

/**
 * Export all states (for backup to storage)
 */
export function exportStates(): Map<number, MutableTabState> {
  return new Map(tabStates);
}

/**
 * Import states (for restore from storage)
 */
export function importStates(states: Map<number, MutableTabState>): void {
  tabStates.clear();
  for (const [tabId, state] of states) {
    tabStates.set(tabId, state);
  }
}

/**
 * Clear all states (for testing)
 */
export function clearAllStates(): void {
  tabStates.clear();
}
