/**
 * Service Worker - Tab State Manager
 *
 * Manages per-tab state including events, containers, and recording status.
 * Acts as single source of truth for tab data.
 *
 * Uses chrome.storage.session for persistence to survive service worker dormancy.
 */

import {
  createInitialTabState,
  type MutableTabState,
  type DataLayerEvent,
} from "@shared/types";
import { LIMITS, STORAGE_KEYS } from "@shared/constants";

/**
 * In-memory storage of tab states
 * Map<tabId, TabState>
 */
const tabStates = new Map<number, MutableTabState>();

/**
 * Flag to track if we've restored from storage
 */
let isRestored = false;

/**
 * Debounce timer for persistence
 */
let persistTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Persist tab states to session storage (debounced)
 */
function schedulePersist(): void {
  if (persistTimeout) {
    clearTimeout(persistTimeout);
  }

  persistTimeout = setTimeout(() => {
    void persistToStorage();
  }, 100);
}

/**
 * Actually persist to storage
 */
async function persistToStorage(): Promise<void> {
  try {
    const serializable: Record<string, MutableTabState> = {};
    for (const [tabId, state] of tabStates) {
      serializable[tabId.toString()] = state;
    }

    await chrome.storage.session.set({
      [STORAGE_KEYS.TAB_STATES]: serializable,
    });
  } catch (error) {
    console.error("[Strata] Failed to persist tab states:", error);
  }
}

/**
 * Restore tab states from session storage
 */
export async function restoreFromStorage(): Promise<void> {
  if (isRestored) return;

  try {
    const result = await chrome.storage.session.get(STORAGE_KEYS.TAB_STATES);
    const stored = result[STORAGE_KEYS.TAB_STATES] as
      | Record<string, MutableTabState>
      | undefined;

    if (stored) {
      tabStates.clear();
      for (const [tabIdStr, state] of Object.entries(stored)) {
        tabStates.set(Number(tabIdStr), state);
      }
    }

    isRestored = true;
  } catch (error) {
    console.error("[Strata] Failed to restore tab states:", error);
    isRestored = true; // Mark as restored to avoid retrying
  }
}

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
    schedulePersist();
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

  schedulePersist();
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
  schedulePersist();
}

/**
 * Set recording state for a tab
 */
export function setRecording(tabId: number, isRecording: boolean): void {
  const state = getOrCreateTabState(tabId);
  state.isRecording = isRecording;
  schedulePersist();
}

/**
 * Clear events for a tab (keeps containers and recording state)
 */
export function clearEvents(tabId: number): void {
  const state = tabStates.get(tabId);
  if (state) {
    state.events = [];
    state.nextIndex = 1;
    schedulePersist();
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
    schedulePersist();
  }
}

/**
 * Update tab URL without clearing events (for same-origin navigation)
 */
export function updateTabUrl(tabId: number, newUrl: string): void {
  const state = tabStates.get(tabId);
  if (state) {
    state.url = newUrl;
    schedulePersist();
  }
}

/**
 * Remove tab state entirely (for tab close)
 */
export function removeTabState(tabId: number): boolean {
  const deleted = tabStates.delete(tabId);
  if (deleted) {
    schedulePersist();
  }
  return deleted;
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
