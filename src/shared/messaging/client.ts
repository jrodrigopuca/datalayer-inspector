/**
 * Request/response client for the service worker.
 *
 * The one place that calls chrome.runtime.sendMessage for a reply; used by
 * the DevTools panel, the popup and the content script
 * (docs/TECH-DEBT.md, item 8).
 */

import type {
  ClientToBackgroundRequest,
  ClientToBackgroundResponse,
} from "../types";

/**
 * Send a request and await its typed response.
 *
 * Rejects when the runtime reports an error (e.g. the service worker is not
 * reachable) or when no listener answered.
 */
export async function sendRequest(
  request: ClientToBackgroundRequest
): Promise<ClientToBackgroundResponse> {
  const response: unknown = await chrome.runtime.sendMessage(request);

  if (
    typeof response !== "object" ||
    response === null ||
    typeof (response as { type?: unknown }).type !== "string"
  ) {
    throw new Error("No response from the service worker");
  }

  return response as ClientToBackgroundResponse;
}
