/**
 * Content Script - Entry Point
 *
 * Runs in the isolated world with access to chrome.runtime but not the
 * page's window. Bridges the MAIN-world page script and the service worker.
 *
 * Runs at: document_start. The page script (a MAIN-world content script)
 * starts on its own and buffers until we send the DL_CONFIG handshake, so
 * nothing captured before the settings round-trip is lost
 * (docs/TECH-DEBT.md, item 5).
 */

import { sendRequest } from "@shared/messaging/client";
import { CLIENT_REQUEST_TYPE, CLIENT_RESPONSE_TYPE } from "@shared/types";
import { postConfigToPage, setEnabled, startRelay } from "./relay";

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
  // Listen first so no page message can slip past once we hand-shake
  startRelay();

  // Load configuration (enabled state + monitored dataLayer names)
  const config = await loadConfig();
  setEnabled(config.enabled);

  // Handshake: the page script flushes its buffer (or drops it if disabled)
  postConfigToPage(config);
}

/**
 * Load configuration from extension settings
 */
async function loadConfig(): Promise<ContentConfig> {
  try {
    const response = await sendRequest({
      type: CLIENT_REQUEST_TYPE.GET_SETTINGS,
    });

    if (response.type === CLIENT_RESPONSE_TYPE.SETTINGS) {
      const { enabled, dataLayerNames } = response.payload;
      return {
        enabled: enabled ?? true,
        dataLayerNames:
          Array.isArray(dataLayerNames) && dataLayerNames.length > 0
            ? [...dataLayerNames]
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
