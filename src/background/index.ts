/**
 * Service Worker - Entry Point
 *
 * Background service worker for the extension.
 * Handles:
 * - Message routing from content scripts
 * - Request/response from DevTools panel and popup
 * - Tab lifecycle events
 * - Long-lived port connections
 *
 * MV3 RULE: all chrome.* event listeners MUST be registered synchronously
 * at the top level. When a message wakes a dormant service worker, Chrome
 * only delivers it to listeners registered in the first synchronous pass -
 * registering after an await causes "Receiving end does not exist".
 * Handlers that need restored state await the `ready` gate instead.
 */

import { BACKGROUND_MESSAGE_TYPE, PORT_NAME } from "@shared/types";
import { updateBadge } from "./badge";
import {
  handleClientRequest,
  handleContentMessage,
  handleTabNavigation,
  handleTabRemoved,
  isClientRequest,
  toggleExtensionEnabled,
} from "./message-handler";
import { broadcastToTab, registerPort } from "./port-manager";
import { reinjectOnFreshStart } from "./reinject";
import * as storage from "./storage";
import * as tabManager from "./tab-manager";

/**
 * Async state restoration. Starts immediately; never rejects so the
 * gate can be awaited unconditionally.
 */
const ready: Promise<void> = (async () => {
  try {
    // Restore tab states from session storage (survives SW dormancy)
    await tabManager.restoreFromStorage();

    // Apply user-configured event limit
    const settings = await storage.getSettings();
    tabManager.setMaxEventsPerTab(settings.maxEventsPerTab);
    await updateBadge(settings.enabled);
  } catch (error) {
    console.error("[Strata] State restore failed:", error);
  }
})();

// Keep the event limit in sync with settings changes
storage.onSettingsChanged((updated) => {
  tabManager.setMaxEventsPerTab(updated.maxEventsPerTab);
  void updateBadge(updated.enabled);
});

// Surface persistence problems in the panel instead of only in the console
tabManager.onStorageWarning((warning) => {
  broadcastToTab(warning.tabId, {
    type: BACKGROUND_MESSAGE_TYPE.STORAGE_WARNING,
    payload: warning,
  });
});

// ============================================================================
// Listener registration - synchronous, top level (see MV3 RULE above)
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Check if this is a client request (expects response)
  if (isClientRequest(message)) {
    ready
      .then(() => handleClientRequest(message, sender))
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          type: "ERROR",
          payload: { message: String(error) },
        });
      });
    // Return true to indicate async response
    return true;
  }

  // Otherwise treat as content script message (no response needed)
  ready
    .then(() => handleContentMessage(message, sender))
    .catch((error: unknown) => {
      console.error("[Strata] Failed to handle content message:", error);
    });
  return false;
});

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

// Tab closed
chrome.tabs.onRemoved.addListener((tabId) => {
  void ready.then(() => handleTabRemoved(tabId));
});

// Tab navigation (URL change) - only react to pathname changes, not hash/query
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url) return;
  const newUrl = changeInfo.url;

  void ready.then(() => {
    const state = tabManager.getTabState(tabId);

    // No previous state, let handleTabNavigation deal with it
    if (!state?.url) {
      void handleTabNavigation(tabId, newUrl);
      return;
    }

    try {
      const oldUrl = new URL(state.url);
      const parsedNewUrl = new URL(newUrl);

      // Only trigger navigation for origin or pathname changes
      // Ignore hash and query param changes (SPAs, anchors, etc.)
      const hasSignificantChange =
        oldUrl.origin !== parsedNewUrl.origin ||
        oldUrl.pathname !== parsedNewUrl.pathname;

      if (hasSignificantChange) {
        void handleTabNavigation(tabId, newUrl);
      } else {
        // Just update URL without any reset logic
        tabManager.updateTabUrl(tabId, newUrl);
      }
    } catch {
      // Invalid URL, let handleTabNavigation deal with it
      void handleTabNavigation(tabId, newUrl);
    }
  });
});

// Tabs open before an install/update/reload/enable keep a dead relay: give
// them a live one so capture resumes without a page reload. Runs once per
// extension process (session marker), not on every worker wake-up.
reinjectOnFreshStart()
  .then((count) => {
    if (count !== null) {
      console.log(`[Strata] Re-injected content script into ${count} tab(s)`);
    }
  })
  .catch((error: unknown) => {
    console.error("[Strata] Content script re-injection failed:", error);
  });

// Keyboard shortcut commands
chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-recording") {
    toggleExtensionEnabled()
      .then(() => {
        console.log("[Strata] Extension toggled via keyboard shortcut");
      })
      .catch((error: unknown) => {
        console.error("[Strata] Failed to toggle extension:", error);
      });
  }
});

console.log("[Strata] Service worker initialized");
