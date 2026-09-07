/**
 * Page Script - Config Listener
 *
 * The page script runs in the MAIN world before the extension's isolated
 * relay is guaranteed to be listening. The relay sends a DL_CONFIG handshake
 * once it is ready; until then the emitter buffers (see message-emitter.ts).
 *
 * CRITICAL: runs in page context - validate loosely, fail silently.
 */

import type { ContentToPageMessage, PageConfigPayload } from "@shared/types";
import { CONTENT_TO_PAGE_TYPE, MESSAGE_SOURCE } from "@shared/types";

function isConfigMessage(data: unknown): data is ContentToPageMessage {
  if (typeof data !== "object" || data === null) return false;
  const message = data as Record<string, unknown>;
  if (message.source !== MESSAGE_SOURCE) return false;
  if (message.type !== CONTENT_TO_PAGE_TYPE.CONFIG) return false;

  const payload = message.payload;
  if (typeof payload !== "object" || payload === null) return false;
  const config = payload as Record<string, unknown>;

  return (
    typeof config.enabled === "boolean" &&
    Array.isArray(config.dataLayerNames) &&
    config.dataLayerNames.every((name) => typeof name === "string") &&
    typeof config.relayId === "string" &&
    config.relayId.length > 0
  );
}

/**
 * Invoke `onConfig` for every valid DL_CONFIG message from this window
 */
export function listenForConfig(
  onConfig: (config: PageConfigPayload) => void
): void {
  try {
    window.addEventListener("message", (event: MessageEvent<unknown>) => {
      if (event.source !== window) return;
      if (!isConfigMessage(event.data)) return;
      try {
        onConfig(event.data.payload);
      } catch {
        // Silent fail - must not break page
      }
    });
  } catch {
    // Silent fail
  }
}
