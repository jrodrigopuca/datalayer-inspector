/**
 * Service Worker - Entry Point
 *
 * Background service worker for the extension.
 * Handles:
 * - Message routing from content scripts
 * - Request/response from DevTools panel and popup
 * - Tab lifecycle events
 * - Long-lived port connections
 */

import { registerPort } from "./port-manager";
import {
  handleContentMessage,
  handleClientRequest,
  handleTabRemoved,
  handleTabNavigation,
  toggleExtensionEnabled,
} from "./message-handler";
import { PORT_NAME } from "@shared/types";
import * as tabManager from "./tab-manager";

/**
 * Initialize service worker
 */
async function init(): Promise<void> {
  // Restore tab states from session storage first (survives service worker dormancy)
  await tabManager.restoreFromStorage();

  setupMessageListeners();
  setupPortListener();
  setupTabListeners();
  setupCommandListener();

  console.log("[Strata] Service worker initialized");
}

/**
 * Set up message listeners
 */
function setupMessageListeners(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Check if this is a client request (expects response)
    if (isClientRequest(message)) {
      handleClientRequest(message, sender)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            type: "ERROR",
            payload: { message: String(error) },
          });
        });
      // Return true to indicate async response
      return true;
    }

    // Otherwise treat as content script message (no response needed)
    handleContentMessage(message, sender);
    return false;
  });
}

/**
 * Check if message is a client request (vs content script message)
 */
function isClientRequest(message: unknown): boolean {
  if (typeof message !== "object" || message === null) {
    return false;
  }

  const type = (message as Record<string, unknown>).type;

  // Client requests use these types
  const clientTypes = [
    "GET_EVENTS",
    "GET_CONTAINERS",
    "CLEAR_EVENTS",
    "SET_RECORDING",
    "GET_TAB_STATE",
    "GET_SETTINGS",
    "UPDATE_SETTINGS",
  ];

  return typeof type === "string" && clientTypes.includes(type);
}

/**
 * Set up long-lived port connections
 */
function setupPortListener(): void {
  chrome.runtime.onConnect.addListener((port) => {
    // Validate port name
    if (
      !Object.values(PORT_NAME).includes(
        port.name as (typeof PORT_NAME)[keyof typeof PORT_NAME]
      )
    ) {
      console.warn(`[Strata] Unknown port: ${port.name}`);
      return;
    }

    // Get tab ID from port sender or from first message
    const senderTabId = port.sender?.tab?.id;

    if (senderTabId !== undefined) {
      // Content script or popup with tab context
      registerPort(port, senderTabId);
    } else {
      // DevTools panel - get tabId from inspectedWindow
      port.onMessage.addListener(function handleFirstMessage(message: unknown) {
        if (
          typeof message === "object" &&
          message !== null &&
          "tabId" in message &&
          typeof (message as { tabId: unknown }).tabId === "number"
        ) {
          registerPort(port, (message as { tabId: number }).tabId);
          port.onMessage.removeListener(handleFirstMessage);
        }
      });
    }
  });
}

/**
 * Set up tab lifecycle listeners
 */
function setupTabListeners(): void {
  // Tab closed
  chrome.tabs.onRemoved.addListener((tabId) => {
    handleTabRemoved(tabId);
  });

  // Tab navigation (URL change) - only react to pathname changes, not hash/query
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      const state = tabManager.getTabState(tabId);

      // No previous state, let handleTabNavigation deal with it
      if (!state?.url) {
        handleTabNavigation(tabId, changeInfo.url);
        return;
      }

      try {
        const oldUrl = new URL(state.url);
        const newUrl = new URL(changeInfo.url);

        // Only trigger navigation for origin or pathname changes
        // Ignore hash and query param changes (SPAs, anchors, etc.)
        const hasSignificantChange =
          oldUrl.origin !== newUrl.origin ||
          oldUrl.pathname !== newUrl.pathname;

        if (hasSignificantChange) {
          handleTabNavigation(tabId, changeInfo.url);
        } else {
          // Just update URL without any reset logic
          tabManager.updateTabUrl(tabId, changeInfo.url);
        }
      } catch {
        // Invalid URL, let handleTabNavigation deal with it
        handleTabNavigation(tabId, changeInfo.url);
      }
    }
  });

  // Handle browser action click (if no popup)
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id !== undefined) {
      // Could open DevTools or show a notification
      console.log(`[Strata] Action clicked for tab ${tab.id}`);
    }
  });
}

/**
 * Set up keyboard shortcut commands
 */
function setupCommandListener(): void {
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === "toggle-recording") {
      await toggleExtensionEnabled();
      console.log("[Strata] Extension toggled via keyboard shortcut");
    }
  });
}

// Initialize
void init();
