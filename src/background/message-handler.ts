/**
 * Service Worker - Message Handler
 *
 * Handles incoming messages from content scripts and client requests
 * from DevTools panels and popups.
 */

import {
  isContentToBackgroundMessage,
  isClientToBackgroundRequest,
} from "@shared/validators";
import {
  CONTENT_MESSAGE_TYPE,
  CLIENT_REQUEST_TYPE,
  CLIENT_RESPONSE_TYPE,
  BACKGROUND_MESSAGE_TYPE,
  TAB_RESET_REASON,
  BACKGROUND_TO_CONTENT_TYPE,
  toReadonlyTabState,
} from "@shared/types";
import type {
  ContentToBackgroundMessage,
  ClientToBackgroundRequest,
  ClientToBackgroundResponse,
  GTMContainer,
} from "@shared/types";

import * as tabManager from "./tab-manager";
import * as portManager from "./port-manager";
import * as storage from "./storage";

/**
 * Handle message from content script
 */
export async function handleContentMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender
): Promise<void> {
  // Validate message
  if (!isContentToBackgroundMessage(message)) {
    return;
  }

  // Must have sender tab
  const tabId = sender.tab?.id;
  if (tabId === undefined) {
    return;
  }

  // Check if extension is enabled
  const settings = await storage.getSettings();
  if (!settings.enabled) {
    return;
  }

  switch (message.type) {
    case CONTENT_MESSAGE_TYPE.EVENT:
      handleEvent(tabId, message);
      break;

    case CONTENT_MESSAGE_TYPE.CONTAINERS:
      handleContainers(tabId, message);
      break;

    case CONTENT_MESSAGE_TYPE.INIT:
      handleInit(tabId, message);
      break;
  }
}

/**
 * Handle captured dataLayer event
 */
function handleEvent(
  tabId: number,
  message: Extract<ContentToBackgroundMessage, { type: "DL_EVENT" }>
): void {
  const event = tabManager.addEvent(tabId, message.payload);

  if (event) {
    // Broadcast to connected clients
    portManager.broadcastToTab(tabId, {
      type: BACKGROUND_MESSAGE_TYPE.NEW_EVENT,
      payload: event,
    });
  }
}

/**
 * Handle detected containers
 */
function handleContainers(
  tabId: number,
  message: Extract<ContentToBackgroundMessage, { type: "DL_CONTAINERS" }>
): void {
  const containerIds = message.payload.containers.map(
    (c: GTMContainer) => c.id
  );
  tabManager.updateContainers(tabId, containerIds);

  // Broadcast to connected clients
  portManager.broadcastToTab(tabId, {
    type: BACKGROUND_MESSAGE_TYPE.CONTAINERS_UPDATED,
    payload: { containers: containerIds },
  });
}

/**
 * Handle initialization message
 */
function handleInit(
  tabId: number,
  _message: Extract<ContentToBackgroundMessage, { type: "DL_INIT" }>
): void {
  // Ensure tab state exists
  tabManager.getOrCreateTabState(tabId);
}

/**
 * Handle request from DevTools panel or popup
 */
export async function handleClientRequest(
  request: unknown,
  _sender: chrome.runtime.MessageSender
): Promise<ClientToBackgroundResponse> {
  // Validate request
  if (!isClientToBackgroundRequest(request)) {
    return {
      type: CLIENT_RESPONSE_TYPE.ERROR,
      payload: { message: "Invalid request format" },
    };
  }

  try {
    return await processClientRequest(request);
  } catch (error) {
    return {
      type: CLIENT_RESPONSE_TYPE.ERROR,
      payload: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

/**
 * Process validated client request
 */
async function processClientRequest(
  request: ClientToBackgroundRequest
): Promise<ClientToBackgroundResponse> {
  switch (request.type) {
    case CLIENT_REQUEST_TYPE.GET_EVENTS: {
      const events = tabManager.getEvents(request.payload.tabId);
      return {
        type: CLIENT_RESPONSE_TYPE.EVENTS,
        payload: { events },
      };
    }

    case CLIENT_REQUEST_TYPE.GET_CONTAINERS: {
      const containers = tabManager.getContainers(request.payload.tabId);
      return {
        type: CLIENT_RESPONSE_TYPE.CONTAINERS,
        payload: { containers },
      };
    }

    case CLIENT_REQUEST_TYPE.GET_TAB_STATE: {
      // Use getOrCreateTabState to ensure we always have a state
      // This fixes the case where popup opens before any events were captured
      const state = tabManager.getOrCreateTabState(request.payload.tabId);
      return {
        type: CLIENT_RESPONSE_TYPE.TAB_STATE,
        payload: toReadonlyTabState(state),
      };
    }

    case CLIENT_REQUEST_TYPE.CLEAR_EVENTS: {
      const { tabId } = request.payload;
      tabManager.clearEvents(tabId);

      // Notify connected clients
      portManager.broadcastToTab(tabId, {
        type: BACKGROUND_MESSAGE_TYPE.TAB_STATE_RESET,
        payload: { tabId, reason: TAB_RESET_REASON.CLEARED },
      });

      return { type: CLIENT_RESPONSE_TYPE.OK };
    }

    case CLIENT_REQUEST_TYPE.SET_RECORDING: {
      const { tabId, isRecording } = request.payload;
      tabManager.setRecording(tabId, isRecording);

      // Notify connected clients
      portManager.broadcastToTab(tabId, {
        type: BACKGROUND_MESSAGE_TYPE.RECORDING_CHANGED,
        payload: { isRecording },
      });

      return { type: CLIENT_RESPONSE_TYPE.OK };
    }

    case CLIENT_REQUEST_TYPE.GET_SETTINGS: {
      const settings = await storage.getSettings();
      return {
        type: CLIENT_RESPONSE_TYPE.SETTINGS,
        payload: settings,
      };
    }

    case CLIENT_REQUEST_TYPE.UPDATE_SETTINGS: {
      const oldSettings = await storage.getSettings();
      const settings = await storage.updateSettings(request.payload);

      // If enabled state changed, notify all content scripts
      if (oldSettings.enabled !== settings.enabled) {
        await notifyAllContentScripts(settings.enabled);

        // Also broadcast to all connected clients (popup, devtools)
        portManager.broadcastToAll({
          type: BACKGROUND_MESSAGE_TYPE.EXTENSION_ENABLED_CHANGED,
          payload: { enabled: settings.enabled },
        });
      }

      return {
        type: CLIENT_RESPONSE_TYPE.SETTINGS,
        payload: settings,
      };
    }

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = request;
      return _exhaustive;
    }
  }
}

/**
 * Handle tab removed event
 */
export function handleTabRemoved(tabId: number): void {
  tabManager.removeTabState(tabId);
}

/**
 * Handle tab navigation (URL change)
 */
export function handleTabNavigation(tabId: number, newUrl: string): void {
  const state = tabManager.getTabState(tabId);
  if (!state) return;

  // Parse origins - handle edge cases gracefully
  let oldOrigin = "";
  let newOrigin = "";

  try {
    if (state.url) oldOrigin = new URL(state.url).origin;
  } catch {
    /* invalid URL, treat as different origin */
  }

  try {
    newOrigin = new URL(newUrl).origin;
  } catch {
    /* invalid URL, treat as different origin */
  }

  const isCrossOrigin = oldOrigin !== newOrigin;

  if (isCrossOrigin) {
    // Cross-origin: full reset
    tabManager.resetTabState(tabId, newUrl);
    portManager.broadcastToTab(tabId, {
      type: BACKGROUND_MESSAGE_TYPE.TAB_STATE_RESET,
      payload: { tabId, reason: TAB_RESET_REASON.NAVIGATION },
    });
  } else {
    // Same-origin: just update URL, keep events
    tabManager.updateTabUrl(tabId, newUrl);
  }
}

/**
 * Notify all content scripts of enabled state change
 */
async function notifyAllContentScripts(enabled: boolean): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    const message = {
      type: BACKGROUND_TO_CONTENT_TYPE.SET_ENABLED,
      payload: { enabled },
    };

    for (const tab of tabs) {
      if (tab.id !== undefined) {
        // Send to each tab, ignore errors (tab might not have content script)
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      }
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Toggle the extension enabled state (for keyboard shortcut)
 */
export async function toggleExtensionEnabled(): Promise<boolean> {
  const currentSettings = await storage.getSettings();
  const newEnabled = !currentSettings.enabled;

  await storage.updateSettings({ enabled: newEnabled });
  await notifyAllContentScripts(newEnabled);

  // Broadcast to all connected clients (popup, devtools)
  portManager.broadcastToAll({
    type: BACKGROUND_MESSAGE_TYPE.EXTENSION_ENABLED_CHANGED,
    payload: { enabled: newEnabled },
  });

  return newEnabled;
}
