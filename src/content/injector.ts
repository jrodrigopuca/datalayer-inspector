/**
 * Content Script - Page Script Injector
 *
 * Injects the page script into the page context at document_start
 * to capture dataLayer.push() calls before any other scripts run.
 */

/**
 * Inject the page script into the page context
 *
 * @param config - Configuration to pass to page script
 */
export function injectPageScript(config: { dataLayerNames: string[] }): void {
  try {
    // Get URL of the compiled page script from extension
    const scriptUrl = chrome.runtime.getURL("page-script.js");

    // Create script element
    const script = document.createElement("script");
    script.src = scriptUrl;
    // Use regular script, not module - the page script is bundled as IIFE
    script.type = "text/javascript";

    // Pass configuration via data attribute
    script.setAttribute("data-config", JSON.stringify(config));

    // Inject at document start (before any other scripts)
    const target = document.head || document.documentElement;
    target.insertBefore(script, target.firstChild);

    // Clean up after execution
    script.onload = () => {
      script.remove();
    };
  } catch (error) {
    console.error("[Strata] Failed to inject page script:", error);
  }
}
