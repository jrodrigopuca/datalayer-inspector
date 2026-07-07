/**
 * Content Script - Entry Point
 *
 * Runs in isolated world with access to DOM but not page's window.
 * Bridges communication between page script and service worker.
 *
 * Runs at: document_start
 */

import { CLIENT_REQUEST_TYPE, CLIENT_RESPONSE_TYPE } from "@shared/types";
import { injectPageScript } from "./injector";
import { setEnabled, startRelay } from "./relay";

interface ContentConfig {
  enabled: boolean;
  dataLayerNames: string[];
}

const DEFAULT_CONFIG: ContentConfig = {
  enabled: true,
  dataLayerNames: ["dataLayer"],
};

/**
 * Initialize content script
 */
async function init(): Promise<void> {
  // Load configuration (enabled state + monitored dataLayer names)
  const config = await loadConfig();
  setEnabled(config.enabled);

  // Start listening for messages (including enable/disable commands)
  startRelay();

  // Only inject page script if enabled
  if (config.enabled) {
    injectPageScript({
      dataLayerNames: config.dataLayerNames,
    });
  }
}

/**
 * Load configuration from extension settings
 */
async function loadConfig(): Promise<ContentConfig> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: CLIENT_REQUEST_TYPE.GET_SETTINGS,
    });

    if (response?.type === CLIENT_RESPONSE_TYPE.SETTINGS) {
      const { enabled, dataLayerNames } = response.payload;
      return {
        enabled: enabled ?? true,
        dataLayerNames:
          Array.isArray(dataLayerNames) && dataLayerNames.length > 0
            ? dataLayerNames
            : DEFAULT_CONFIG.dataLayerNames,
      };
    }
    return DEFAULT_CONFIG;
  } catch {
    // If we can't reach background, assume defaults
    return DEFAULT_CONFIG;
  }
}

// Initialize immediately
init().catch((error: unknown) => {
  console.error("[Strata] Content script init failed:", error);
});
