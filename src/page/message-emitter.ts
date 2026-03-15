/**
 * Page Script - Message Emitter
 *
 * Handles communication with content script via window.postMessage
 *
 * CRITICAL: This runs in page context - fail silently on errors
 */

import { MESSAGE_SOURCE, PAGE_MESSAGE_TYPE } from "@shared/types";
import type { GTMContainer } from "@shared/types";

/**
 * Captured event data to emit
 */
export interface CapturedEventData {
  readonly id: string;
  readonly timestamp: number;
  readonly url: string;
  readonly eventName: string | null;
  readonly data: Record<string, unknown>;
  readonly containerIds: readonly string[];
  readonly sourceName: string;
  readonly index: number;
}

/**
 * Emit captured event to content script
 */
export function emitEvent(eventData: CapturedEventData): void {
  try {
    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
        payload: eventData,
      },
      "*"
    );
  } catch {
    // Silent fail - must not affect page
  }
}

/**
 * Emit detected containers to content script
 */
export function emitContainers(containers: readonly GTMContainer[]): void {
  try {
    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED,
        payload: { containers },
      },
      "*"
    );
  } catch {
    // Silent fail
  }
}

/**
 * Emit initialization complete message
 */
export function emitInitialized(
  dataLayerNames: readonly string[],
  existingEventsCount: number
): void {
  try {
    window.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: PAGE_MESSAGE_TYPE.INITIALIZED,
        payload: { dataLayerNames, existingEventsCount },
      },
      "*"
    );
  } catch {
    // Silent fail
  }
}
