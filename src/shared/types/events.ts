/**
 * Core event types for dataLayer capture
 */

/** Unique identifier for each dataLayer push */
export type EventId = string;

/**
 * Represents a single push to the dataLayer
 */
export interface DataLayerEvent {
  /** UUID v4 generated in page script at capture time */
  readonly id: EventId;
  /** Timestamp in ms (Date.now()) at push moment */
  readonly timestamp: number;
  /** Full URL (location.href) at push moment */
  readonly url: string;
  /** Value of "event" key if exists, null otherwise */
  readonly eventName: string | null;
  /** Full push payload (the object passed to dataLayer.push()) */
  readonly data: Record<string, unknown>;
  /** GTM container IDs detected at push moment */
  readonly containerIds: readonly string[];
  /** Name of source dataLayer array ("dataLayer" by default) */
  readonly source: string;
  /** Sequential event number in tab session (1-based) */
  readonly index: number;
}

/**
 * State of a monitored tab
 */
export interface TabState {
  readonly tabId: number;
  /** Captured events, ordered by timestamp ASC */
  readonly events: readonly DataLayerEvent[];
  /** GTM containers detected in tab */
  readonly containers: readonly string[];
  /** Current tab URL */
  readonly url: string;
  /** Whether capture is active */
  readonly isRecording: boolean;
  /** Incremental counter for assigning event index */
  readonly nextIndex: number;
}

/**
 * Detected GTM container
 */
export interface GTMContainer {
  /** Container ID (e.g., "GTM-XXXXXX") */
  readonly id: string;
  /** Associated dataLayer name */
  readonly dataLayerName: string;
}

/**
 * Mutable version of TabState for internal use in service worker
 */
export interface MutableTabState {
  tabId: number;
  events: DataLayerEvent[];
  containers: string[];
  url: string;
  isRecording: boolean;
  nextIndex: number;
}

/**
 * Convert mutable state to readonly
 */
export function toReadonlyTabState(state: MutableTabState): TabState {
  return {
    ...state,
    events: [...state.events],
    containers: [...state.containers],
  };
}

/**
 * Create initial tab state
 */
export function createInitialTabState(
  tabId: number,
  url: string = ""
): MutableTabState {
  return {
    tabId,
    events: [],
    containers: [],
    url,
    isRecording: true,
    nextIndex: 1,
  };
}
