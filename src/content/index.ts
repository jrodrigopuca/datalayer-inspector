/**
 * Content Script - Entry Point
 *
 * Runs in isolated world with access to DOM but not page's window.
 * Bridges communication between page script and service worker.
 *
 * Runs at: document_start
 */

import { injectPageScript } from "./injector";
import { startRelay, setEnabled } from "./relay";
import { CLIENT_REQUEST_TYPE, CLIENT_RESPONSE_TYPE } from "@shared/types";

/**
 * Initialize content script
 */
async function init(): Promise<void> {
  // Check if extension is enabled before doing anything
  const isEnabled = await checkIfEnabled();
  setEnabled(isEnabled);

  // Start listening for messages (including enable/disable commands)
  startRelay();

  // Only inject page script if enabled
  if (isEnabled) {
    // Inject page script with default configuration
    // TODO: Load configuration from storage/settings
    injectPageScript({
      dataLayerNames: ["dataLayer"],
    });
  }
}

/**
 * Check if extension is enabled
 */
async function checkIfEnabled(): Promise<boolean> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: CLIENT_REQUEST_TYPE.GET_SETTINGS,
    });
    
    if (response?.type === CLIENT_RESPONSE_TYPE.SETTINGS) {
      return response.payload.enabled ?? true;
    }
    return true;
  } catch {
    // If we can't reach background, assume enabled
    return true;
  }
}

// Initialize immediately
init();
