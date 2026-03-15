/**
 * Page Script - Entry Point
 *
 * Injected into page context to intercept dataLayer.push()
 *
 * CRITICAL REQUIREMENTS:
 * - Bundle size < 5KB
 * - Zero impact on page performance
 * - Silent failure on errors
 * - No global pollution
 */

import { interceptDataLayer, setContainerIds } from "./interceptor";
import {
  detectContainers,
  getContainerIds,
  shouldRedetectContainers,
} from "./container-detector";
import { emitEvent, emitContainers, emitInitialized } from "./message-emitter";

/**
 * Configuration passed via data attribute on script tag
 */
interface PageScriptConfig {
  dataLayerNames: string[];
}

/**
 * Read configuration from script tag data attribute
 */
function readConfig(): PageScriptConfig {
  try {
    const scriptTag = document.currentScript;
    if (!scriptTag) {
      return { dataLayerNames: ["dataLayer"] };
    }

    const configAttr = scriptTag.getAttribute("data-config");
    if (!configAttr) {
      return { dataLayerNames: ["dataLayer"] };
    }

    const config = JSON.parse(configAttr) as Partial<PageScriptConfig>;
    return {
      dataLayerNames: Array.isArray(config.dataLayerNames)
        ? config.dataLayerNames
        : ["dataLayer"],
    };
  } catch {
    return { dataLayerNames: ["dataLayer"] };
  }
}

/**
 * Initialize page script
 */
function init(): void {
  try {
    const config = readConfig();
    let totalExistingEvents = 0;

    // Detect initial containers
    const initialContainers = detectContainers();
    const containerIds = getContainerIds();
    setContainerIds(containerIds);

    if (initialContainers.length > 0) {
      emitContainers(initialContainers);
    }

    // Intercept each configured dataLayer
    for (const name of config.dataLayerNames) {
      const existingCount = interceptDataLayer(name, (event) => {
        // Re-detect containers on gtm.js event
        if (shouldRedetectContainers(event.eventName)) {
          const containers = detectContainers();
          const ids = getContainerIds();
          setContainerIds(ids);
          emitContainers(containers);
        }

        emitEvent(event);
      });

      totalExistingEvents += existingCount;
    }

    // Notify initialization complete
    emitInitialized(config.dataLayerNames, totalExistingEvents);
  } catch {
    // Silent fail - must not break page
  }
}

// Execute immediately (IIFE pattern for safety)
init();
