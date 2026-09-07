/**
 * Page Script - Message Emitter
 *
 * Handles communication with content script via window.postMessage.
 *
 * Buffering: the page script starts before the relay is guaranteed to be
 * listening (both are loaded asynchronously at document_start). Every
 * message is held until the relay's DL_CONFIG handshake arrives, then
 * flushed in order. If the extension is disabled, the buffer is dropped and
 * nothing is emitted afterwards.
 *
 * CRITICAL: This runs in page context - fail silently on errors
 */

import type {
  EventTrigger,
  GTMContainer,
  PageToContentMessage,
} from "@shared/types";
import { MESSAGE_SOURCE, PAGE_MESSAGE_TYPE } from "@shared/types";

/** Upper bound on buffered messages while waiting for the handshake */
const MAX_BUFFERED_MESSAGES = 500;

interface EmitterState {
  /** Handshake received: emit directly */
  ready: boolean;
  /** Extension enabled: emit at all */
  enabled: boolean;
  /** Messages captured before the handshake */
  buffer: PageToContentMessage[];
}

const state: EmitterState = {
  ready: false,
  enabled: true,
  buffer: [],
};

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
  readonly trigger?: EventTrigger;
  readonly documentId?: string;
}

/**
 * Apply the relay's config. The first call marks the emitter ready and
 * flushes (or drops) whatever was buffered.
 */
export function configureEmitter(config: { enabled: boolean }): void {
  state.enabled = config.enabled;

  if (!state.ready) {
    state.ready = true;
    flush();
  }
}

/**
 * Number of messages waiting for the handshake (for testing)
 */
export function getBufferedCount(): number {
  return state.buffer.length;
}

/**
 * Reset emitter state (for testing)
 */
export function resetEmitter(): void {
  state.ready = false;
  state.enabled = true;
  state.buffer = [];
}

function post(message: PageToContentMessage): void {
  window.postMessage(message, "*");
}

function flush(): void {
  const pending = state.buffer;
  state.buffer = [];

  if (!state.enabled) return;

  for (const message of pending) {
    try {
      post(message);
    } catch {
      // Silent fail
    }
  }
}

function emit(message: PageToContentMessage): void {
  try {
    if (!state.ready) {
      if (state.buffer.length >= MAX_BUFFERED_MESSAGES) {
        state.buffer.shift();
      }
      state.buffer.push(message);
      return;
    }

    if (!state.enabled) return;

    post(message);
  } catch {
    // Silent fail - must not affect page
  }
}

/**
 * Emit captured event to content script
 */
export function emitEvent(eventData: CapturedEventData): void {
  emit({
    source: MESSAGE_SOURCE,
    type: PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
    payload: eventData,
  });
}

/**
 * Emit detected containers to content script
 */
export function emitContainers(containers: readonly GTMContainer[]): void {
  emit({
    source: MESSAGE_SOURCE,
    type: PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED,
    payload: { containers },
  });
}

/**
 * Emit initialization complete message
 */
export function emitInitialized(
  dataLayerNames: readonly string[],
  existingEventsCount: number
): void {
  emit({
    source: MESSAGE_SOURCE,
    type: PAGE_MESSAGE_TYPE.INITIALIZED,
    payload: { dataLayerNames, existingEventsCount },
  });
}
