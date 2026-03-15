/**
 * Page Script - DataLayer Interceptor
 *
 * Core interception logic for dataLayer.push()
 *
 * Strategy:
 * 1. Save reference to original push
 * 2. Replace with wrapper that:
 *    a) Captures metadata
 *    b) Emits message
 *    c) Calls original
 * 3. Handle dataLayer that doesn't exist yet (Object.defineProperty)
 *
 * CRITICAL: This runs in page context - errors must not break the page
 */

import type { CapturedEventData } from "./message-emitter";

/**
 * Callback for captured events
 */
export type EventCallback = (event: CapturedEventData) => void;

/**
 * Internal state for the interceptor
 */
interface InterceptorState {
  /** Track which arrays we've already intercepted (prevent double-intercept) */
  interceptedArrays: WeakSet<unknown[]>;
  /** Global event counter for index */
  eventIndex: number;
  /** Current container IDs */
  containerIds: string[];
}

// Module-level state (closure, not on window)
const state: InterceptorState = {
  interceptedArrays: new WeakSet(),
  eventIndex: 0,
  containerIds: [],
};

/**
 * Update container IDs for new events
 */
export function setContainerIds(ids: string[]): void {
  state.containerIds = ids;
}

/**
 * Get current event index (for testing)
 */
export function getEventIndex(): number {
  return state.eventIndex;
}

/**
 * Reset state (for testing)
 */
export function resetState(): void {
  state.interceptedArrays = new WeakSet();
  state.eventIndex = 0;
  state.containerIds = [];
}

/**
 * Intercept a dataLayer array
 *
 * @param arrayName - Name of the global array (e.g., "dataLayer")
 * @param onEvent - Callback for each captured event
 * @returns Number of existing events processed
 */
export function interceptDataLayer(
  arrayName: string,
  onEvent: EventCallback
): number {
  try {
    const win = window as unknown as Record<string, unknown>;

    // If array already exists, intercept it
    if (Array.isArray(win[arrayName])) {
      return interceptArray(win[arrayName] as unknown[], arrayName, onEvent);
    }

    // If doesn't exist, set up getter/setter to catch when it's created
    let value: unknown[] | undefined;

    Object.defineProperty(win, arrayName, {
      configurable: true,
      enumerable: true,
      get: () => value,
      set: (newValue: unknown) => {
        value = newValue as unknown[];
        if (Array.isArray(newValue)) {
          interceptArray(newValue as unknown[], arrayName, onEvent);
        }
      },
    });

    return 0;
  } catch {
    // Silent fail - must not break page
    return 0;
  }
}

/**
 * Intercept an existing array
 */
function interceptArray(
  arr: unknown[],
  sourceName: string,
  onEvent: EventCallback
): number {
  // Idempotency: don't intercept twice
  if (state.interceptedArrays.has(arr)) {
    return 0;
  }
  state.interceptedArrays.add(arr);

  // Process existing events
  const existingCount = processExistingEvents(arr, sourceName, onEvent);

  // Intercept push
  const originalPush = arr.push.bind(arr);

  arr.push = function (...items: unknown[]): number {
    for (const item of items) {
      if (isValidPushItem(item)) {
        const event = createCapturedEvent(
          item as Record<string, unknown>,
          sourceName
        );
        onEvent(event);
      }
    }
    return originalPush(...items);
  };

  return existingCount;
}

/**
 * Process events that were already in the array before interception
 */
function processExistingEvents(
  arr: unknown[],
  sourceName: string,
  onEvent: EventCallback
): number {
  let count = 0;

  for (const item of arr) {
    if (isValidPushItem(item)) {
      const event = createCapturedEvent(
        item as Record<string, unknown>,
        sourceName
      );
      onEvent(event);
      count++;
    }
  }

  return count;
}

/**
 * Check if an item is valid for capture
 *
 * Valid items are:
 * - Non-null objects
 * - Not arrays
 * - Not functions (GTM command queue uses functions)
 */
function isValidPushItem(item: unknown): item is Record<string, unknown> {
  return (
    typeof item === "object" &&
    item !== null &&
    !Array.isArray(item) &&
    typeof item !== "function"
  );
}

/**
 * Create a captured event from a dataLayer push
 */
function createCapturedEvent(
  data: Record<string, unknown>,
  sourceName: string
): CapturedEventData {
  state.eventIndex++;

  // Extract event name if present
  const eventName =
    typeof data.event === "string" ? data.event : null;

  // Safely serialize data (handle circular refs)
  const safeData = safeSerialize(data);

  return {
    id: generateId(),
    timestamp: Date.now(),
    url: window.location.href,
    eventName,
    data: safeData,
    containerIds: [...state.containerIds],
    sourceName,
    index: state.eventIndex,
  };
}

/**
 * Generate unique ID
 *
 * Uses crypto.randomUUID if available, falls back to timestamp + random
 */
function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback for older browsers or non-secure contexts
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Safely serialize data, handling circular references
 */
function safeSerialize(data: Record<string, unknown>): Record<string, unknown> {
  const seen = new WeakSet();

  try {
    const jsonString = JSON.stringify(data, (_key, value: unknown) => {
      // Handle circular references
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return "[Circular Reference]";
        }
        seen.add(value);
      }

      // Handle functions
      if (typeof value === "function") {
        return "[Function]";
      }

      // Handle undefined (JSON.stringify removes these)
      if (value === undefined) {
        return "[undefined]";
      }

      // Handle symbols
      if (typeof value === "symbol") {
        return `[Symbol: ${value.description ?? ""}]`;
      }

      return value;
    });

    return JSON.parse(jsonString) as Record<string, unknown>;
  } catch {
    // If serialization fails completely, return minimal info
    return {
      __serialization_error__: true,
      event: typeof data.event === "string" ? data.event : null,
    };
  }
}
