/**
 * Content Script - Message Relay
 *
 * Listens for messages from page script and relays them to service worker.
 * Acts as a bridge between page context and extension context.
 *
 * IMPORTANT: This is a security boundary - validate all incoming messages
 */

import { isPageToContentMessage } from "@shared/validators";
import {
  PAGE_MESSAGE_TYPE,
  CONTENT_MESSAGE_TYPE,
} from "@shared/types";
import type {
  PageToContentMessage,
  ContentToBackgroundMessage,
  DataLayerEvent,
} from "@shared/types";

/**
 * Start listening for messages from page script
 */
export function startRelay(): void {
  window.addEventListener("message", handlePageMessage);
}

/**
 * Stop listening for messages
 */
export function stopRelay(): void {
  window.removeEventListener("message", handlePageMessage);
}

/**
 * Handle incoming message from page script
 */
function handlePageMessage(event: MessageEvent<unknown>): void {
  // Only accept messages from same window (page script)
  if (event.source !== window) {
    return;
  }

  // Validate message structure and source
  if (!isPageToContentMessage(event.data)) {
    return;
  }

  // Relay to service worker
  relayToBackground(event.data);
}

/**
 * Transform and relay message to service worker
 */
function relayToBackground(message: PageToContentMessage): void {
  try {
    const bgMessage = transformMessage(message);
    if (bgMessage) {
      chrome.runtime.sendMessage(bgMessage).catch(() => {
        // Service worker might be suspended, ignore
      });
    }
  } catch {
    // Ignore relay errors
  }
}

/**
 * Transform page message to background message format
 */
function transformMessage(
  message: PageToContentMessage
): ContentToBackgroundMessage | null {
  switch (message.type) {
    case PAGE_MESSAGE_TYPE.EVENT_CAPTURED: {
      const payload = message.payload;
      const event: DataLayerEvent = {
        id: payload.id,
        timestamp: payload.timestamp,
        url: payload.url,
        eventName: payload.eventName,
        data: payload.data,
        containerIds: [...payload.containerIds],
        source: payload.sourceName,
        index: payload.index,
      };

      return {
        type: CONTENT_MESSAGE_TYPE.EVENT,
        payload: event,
      };
    }

    case PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED:
      return {
        type: CONTENT_MESSAGE_TYPE.CONTAINERS,
        payload: {
          containers: [...message.payload.containers],
        },
      };

    case PAGE_MESSAGE_TYPE.INITIALIZED:
      return {
        type: CONTENT_MESSAGE_TYPE.INIT,
        payload: {
          dataLayerNames: [...message.payload.dataLayerNames],
          existingEventsCount: message.payload.existingEventsCount,
        },
      };

    default:
      return null;
  }
}
