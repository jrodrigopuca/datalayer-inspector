/**
 * Content Script - Entry Point
 *
 * Runs in isolated world with access to DOM but not page's window.
 * Bridges communication between page script and service worker.
 *
 * Runs at: document_start
 */

import { injectPageScript } from "./injector";
import { startRelay } from "./relay";

/**
 * Initialize content script
 */
function init(): void {
  // Start listening for messages BEFORE injecting page script
  // to ensure we don't miss any events
  startRelay();

  // Inject page script with default configuration
  // TODO: Load configuration from storage/settings
  injectPageScript({
    dataLayerNames: ["dataLayer"],
  });
}

// Initialize immediately
init();
