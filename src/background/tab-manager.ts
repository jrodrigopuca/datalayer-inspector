/**
 * Service Worker - Tab State Manager
 *
 * Manages per-tab state including events, containers, and recording status.
 * Acts as single source of truth for tab data.
 *
 * Uses chrome.storage.session for persistence to survive service worker
 * dormancy. Each tab is stored under its own key so a write touches only the
 * tab that changed and one oversized tab cannot take the others down with it
 * (docs/TECH-DEBT.md, item 3).
 */

import { LIMITS, STORAGE_KEYS, STORAGE_LIMITS } from "@shared/constants";
import {
  createInitialTabState,
  type DataLayerEvent,
  type MutableTabState,
  STORAGE_WARNING_KIND,
  type StorageWarningPayload,
} from "@shared/types";
import { countToPrune } from "@shared/utils/prune";

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
 * Debounce delay between the last change and the write (ms)
 */
const PERSIST_DEBOUNCE_MS = 100;

/**
 * Pending persistence timers, one per tab
 */
const persistTimers = new Map<number, ReturnType<typeof setTimeout>>();

/**
 * Per-tab serialized size budget (see STORAGE_LIMITS)
 */
let tabStateByteBudget: number = STORAGE_LIMITS.MAX_TAB_STATE_BYTES;

/**
 * Override the per-tab byte budget (testing / future setting)
 */
export function setTabStateByteBudget(bytes: number): void {
  if (Number.isFinite(bytes) && bytes > 0) {
    tabStateByteBudget = bytes;
  }
}

/**
 * Listener notified when persistence had to drop events or failed.
 * The service worker entry point forwards these to the tab's clients.
 */
type StorageWarningListener = (warning: StorageWarningPayload) => void;
let storageWarningListener: StorageWarningListener | null = null;

export function onStorageWarning(
  listener: StorageWarningListener | null
): void {
  storageWarningListener = listener;
}

function emitStorageWarning(warning: StorageWarningPayload): void {
  try {
    storageWarningListener?.(warning);
  } catch (error) {
    console.error("[Strata] Storage warning listener failed:", error);
  }
}

/**
 * Session storage key for a tab
 */
function tabStorageKey(tabId: number): string {
  return `${STORAGE_KEYS.TAB_STATE_PREFIX}${tabId}`;
}

/**
 * Parse a session storage key back into a tab id (null if not ours)
 */
function tabIdFromKey(key: string): number | null {
  if (!key.startsWith(STORAGE_KEYS.TAB_STATE_PREFIX)) return null;
  const tabId = Number(key.slice(STORAGE_KEYS.TAB_STATE_PREFIX.length));
  return Number.isInteger(tabId) ? tabId : null;
}

/**
 * Minimal shape check for a restored state (storage is not fully trusted)
 */
function isTabStateLike(value: unknown): value is MutableTabState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.tabId === "number" &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.containers) &&
    typeof candidate.isRecording === "boolean" &&
    typeof candidate.nextIndex === "number"
  );
}

/**
 * Schedule a debounced write for one tab
 */
function schedulePersist(tabId: number): void {
  const pending = persistTimers.get(tabId);
  if (pending) {
    clearTimeout(pending);
  }

  persistTimers.set(
    tabId,
    setTimeout(() => {
      persistTimers.delete(tabId);
      void persistToStorage(tabId);
    }, PERSIST_DEBOUNCE_MS)
  );
}

/**
 * Drop the oldest events until the serialized state fits the byte budget.
 * Mutates the in-memory state so memory and storage never disagree.
 *
 * @returns Number of events dropped
 */
function pruneToByteBudget(state: MutableTabState): number {
  let size = JSON.stringify(state).length;
  if (size <= tabStateByteBudget) return 0;

  let toDrop = 0;
  // Always keep the newest event, however large it is
  const droppable = state.events.length - 1;
  for (const event of state.events) {
    if (size <= tabStateByteBudget || toDrop >= droppable) break;
    // +1 for the separating comma in the serialized array
    size -= JSON.stringify(event).length + 1;
    toDrop++;
  }

  if (toDrop > 0) {
    state.events.splice(0, toDrop);
  }
  return toDrop;
}

/**
 * Write one tab's state (or remove its key if the tab is gone)
 */
async function persistToStorage(tabId: number): Promise<void> {
  const key = tabStorageKey(tabId);
  const state = tabStates.get(tabId);

  try {
    if (!state) {
      await chrome.storage.session.remove(key);
      return;
    }

    const dropped = pruneToByteBudget(state);
    if (dropped > 0) {
      emitStorageWarning({
        tabId,
        kind: STORAGE_WARNING_KIND.PRUNED_BY_SIZE,
        droppedCount: dropped,
        message: `Dropped ${dropped} oldest event${dropped === 1 ? "" : "s"} to fit the session storage budget`,
      });
    }

    await chrome.storage.session.set({ [key]: state });
  } catch (error) {
    console.error(`[Strata] Failed to persist tab ${tabId}:`, error);
    emitStorageWarning({
      tabId,
      kind: STORAGE_WARNING_KIND.PERSIST_FAILED,
      droppedCount: 0,
      message:
        "Could not save the session; events will be lost if the service worker restarts",
    });
  }
}

/**
 * Restore every tab state from session storage
 */
export async function restoreFromStorage(): Promise<void> {
  if (isRestored) return;

  try {
    const all = await chrome.storage.session.get(null);

    tabStates.clear();
    for (const [key, value] of Object.entries(all)) {
      const tabId = tabIdFromKey(key);
      if (tabId === null) continue;
      if (!isTabStateLike(value)) {
        console.warn(`[Strata] Ignoring malformed stored state for ${key}`);
        continue;
      }
      tabStates.set(tabId, value);
    }

    // Pre-1.5 layout stored every tab under one key; drop it if present
    if (STORAGE_KEYS.LEGACY_TAB_STATES in all) {
      void chrome.storage.session.remove(STORAGE_KEYS.LEGACY_TAB_STATES);
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
    schedulePersist(tabId);
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

  schedulePersist(tabId);
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
  schedulePersist(tabId);
}

/**
 * Set recording state for a tab
 */
export function setRecording(tabId: number, isRecording: boolean): void {
  const state = getOrCreateTabState(tabId);
  state.isRecording = isRecording;
  schedulePersist(tabId);
}

/**
 * Clear events for a tab (keeps containers and recording state)
 */
export function clearEvents(tabId: number): void {
  const state = tabStates.get(tabId);
  if (state) {
    state.events = [];
    state.nextIndex = 1;
    schedulePersist(tabId);
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
    schedulePersist(tabId);
  }
}

/**
 * Update tab URL without clearing events (for same-origin navigation)
 */
export function updateTabUrl(tabId: number, newUrl: string): void {
  const state = tabStates.get(tabId);
  if (state) {
    state.url = newUrl;
    schedulePersist(tabId);
  }
}

/**
 * Remove tab state entirely (for tab close)
 */
export function removeTabState(tabId: number): boolean {
  const deleted = tabStates.delete(tabId);
  if (deleted) {
    // With no in-memory state the write becomes a key removal
    schedulePersist(tabId);
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
 * Configurable event limit (kept in sync with the maxEventsPerTab setting).
 * Defaults to the built-in limit until settings are loaded.
 */
let maxEventsPerTab: number = LIMITS.MAX_EVENTS_PER_TAB;

/**
 * Update the per-tab event limit from user settings
 */
export function setMaxEventsPerTab(limit: number): void {
  if (Number.isFinite(limit) && limit > 0) {
    maxEventsPerTab = limit;
  }
}

/**
 * Prune old events if over limit
 *
 * The rule lives in shared/utils/prune.ts so the DevTools panel applies
 * exactly the same window (docs/TECH-DEBT.md, item 2).
 */
function pruneEventsIfNeeded(state: MutableTabState): void {
  const toRemove = countToPrune(state.events.length, maxEventsPerTab);
  if (toRemove > 0) {
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
 * Clear all states and pending writes (for testing)
 */
export function clearAllStates(): void {
  tabStates.clear();
  for (const timer of persistTimers.values()) {
    clearTimeout(timer);
  }
  persistTimers.clear();
  isRestored = false;
  tabStateByteBudget = STORAGE_LIMITS.MAX_TAB_STATE_BYTES;
  storageWarningListener = null;
}
