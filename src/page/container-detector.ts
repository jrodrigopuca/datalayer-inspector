/**
 * Page Script - Container Detector
 *
 * Detects GTM containers by inspecting window.google_tag_manager
 *
 * Expected structure:
 * window.google_tag_manager = {
 *   "GTM-XXXXX": { dataLayer: { name: "dataLayer" } },
 *   "GTM-YYYYY": { dataLayer: { name: "dataLayer2" } },
 *   "G-XXXXX": { ... }, // GA4 measurement ID
 * }
 */

import type { GTMContainer } from "@shared/types";

// Pattern to match valid container IDs
const CONTAINER_ID_PATTERN = /^(GTM|G|GT)-[A-Z0-9]+$/;

// Type for GTM global object
interface GTMGlobal {
  [containerId: string]:
    | {
        dataLayer?: {
          name?: string;
        };
      }
    | undefined;
}

/**
 * Detect GTM containers from window.google_tag_manager
 */
export function detectContainers(): GTMContainer[] {
  try {
    const gtm = (window as unknown as { google_tag_manager?: GTMGlobal })
      .google_tag_manager;

    if (!gtm || typeof gtm !== "object") {
      return [];
    }

    const containers: GTMContainer[] = [];

    for (const key of Object.keys(gtm)) {
      if (!CONTAINER_ID_PATTERN.test(key)) {
        continue;
      }

      const container = gtm[key];
      const dataLayerName = container?.dataLayer?.name ?? "dataLayer";

      containers.push({
        id: key,
        dataLayerName,
      });
    }

    return containers;
  } catch {
    // Silent fail - return empty array
    return [];
  }
}

/**
 * Extract container IDs only
 */
export function getContainerIds(): string[] {
  return detectContainers().map((c) => c.id);
}

/**
 * Check if an event indicates GTM has loaded (should re-detect)
 */
export function shouldRedetectContainers(eventName: string | null): boolean {
  return eventName === "gtm.js";
}
