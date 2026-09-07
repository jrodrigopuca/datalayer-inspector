/**
 * Content Script - Message Relay
 *
 * Listens for messages from page script and relays them to service worker.
 * Acts as a bridge between page context and extension context.
 *
 * IMPORTANT: This is a security boundary - validate all incoming messages
 */

import type {
  BackgroundToContentMessage,
  ContentToBackgroundMessage,
  ContentToPageMessage,
  DataLayerEvent,
  PageConfigPayload,
  PageToContentMessage,
} from "@shared/types";
import {
  BACKGROUND_TO_CONTENT_TYPE,
  CONTENT_MESSAGE_TYPE,
  CONTENT_TO_PAGE_TYPE,
  MESSAGE_SOURCE,
  PAGE_MESSAGE_TYPE,
} from "@shared/types";
import { isPageToContentMessage } from "@shared/validators";

/** Whether the extension is currently enabled */
let isEnabled = true;

/**
 * Identity of THIS relay instance. The page script compares it across
 * handshakes: a new id means a fresh relay (extension reloaded/enabled),
 * whose worker has no state for the tab yet.
 */
const RELAY_ID: string = (() => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
})();

/** Config to hand to the page script (relayId is added here) */
type PageConfigInput = Omit<PageConfigPayload, "relayId">;

/** Last config handed to the page script (re-sent on enabled changes) */
let lastPageConfig: PageConfigInput = {
  enabled: true,
  dataLayerNames: ["dataLayer"],
};

/**
 * Set the enabled state of the relay
 */
export function setEnabled(enabled: boolean): void {
  isEnabled = enabled;
}

/**
 * Hand the effective config to the MAIN-world page script.
 * The first call is the handshake that makes it flush its buffer.
 */
export function postConfigToPage(config: PageConfigInput): void {
  lastPageConfig = config;
  try {
    const message: ContentToPageMessage = {
      source: MESSAGE_SOURCE,
      type: CONTENT_TO_PAGE_TYPE.CONFIG,
      payload: { ...config, relayId: RELAY_ID },
    };
    window.postMessage(message, "*");
  } catch {
    // Silent fail
  }
}

/**
 * Start listening for messages from page script and background
 */
export function startRelay(): void {
  window.addEventListener("message", handlePageMessage);
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
}

/**
 * Stop listening for messages
 */
export function stopRelay(): void {
  window.removeEventListener("message", handlePageMessage);
  chrome.runtime.onMessage.removeListener(handleBackgroundMessage);
}

/**
 * Handle incoming message from background service worker
 */
function handleBackgroundMessage(message: BackgroundToContentMessage): void {
  if (message.type === BACKGROUND_TO_CONTENT_TYPE.SET_ENABLED) {
    setEnabled(message.payload.enabled);
    // Let the page script stop (or resume) emitting too
    postConfigToPage({ ...lastPageConfig, enabled: message.payload.enabled });
  }
}

/**
 * Handle incoming message from page script
 */
function handlePageMessage(event: MessageEvent<unknown>): void {
  // Ignore if extension is disabled
  if (!isEnabled) {
    return;
  }

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
        ...(payload.trigger && { trigger: payload.trigger }),
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
