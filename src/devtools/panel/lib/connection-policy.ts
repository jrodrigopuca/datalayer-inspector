/**
 * Connection policy for the DevTools panel (docs/TECH-DEBT.md, item 17)
 *
 * Pure decisions, no React and no Chrome calls beyond an injectable check,
 * so the behaviour that used to be buried in the hook is testable:
 *
 * - An INVALIDATED extension context (the extension was reloaded or
 *   updated while this panel was open) can never reconnect: the only fix
 *   is a new panel. Say so, and do not retry.
 * - Any other disconnect (service worker asleep or restarted) is retried
 *   forever with capped exponential backoff.
 */

import { LIMITS } from "@shared/constants";

/** Shown when this panel belongs to a previous version of the extension */
export const CONTEXT_INVALIDATED_MESSAGE =
  "Strata was updated or reloaded. Close and reopen DevTools to reconnect.";

/** Shown when a request got no answer from the worker */
export const NO_RESPONSE_MESSAGE =
  "The service worker did not answer. Try again in a moment.";

type RuntimeLike = { readonly id?: string | undefined } | null | undefined;

/**
 * True when chrome.runtime no longer belongs to a live extension.
 * Chrome leaves `chrome.runtime` in place but clears `id` when the
 * extension that created this page is gone.
 */
export function isExtensionContextInvalidated(
  runtime: RuntimeLike = globalThis.chrome?.runtime
): boolean {
  try {
    return !runtime || typeof runtime.id !== "string" || runtime.id === "";
  } catch {
    return true;
  }
}

/**
 * Chrome throws this from chrome.* APIs inside an orphaned page
 */
export function isContextInvalidatedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("extension context invalidated")
  );
}

export type ReconnectDecision =
  | { readonly action: "retry"; readonly delayMs: number }
  | { readonly action: "stop"; readonly message: string };

/**
 * Decide what to do after a disconnect.
 *
 * @param attempt - Number of retries already made since the last success
 */
export function decideReconnect(input: {
  readonly attempt: number;
  readonly contextInvalidated: boolean;
}): ReconnectDecision {
  if (input.contextInvalidated) {
    return { action: "stop", message: CONTEXT_INVALIDATED_MESSAGE };
  }

  const exponent = Math.max(0, Math.min(input.attempt, 30));
  const delayMs = Math.min(
    LIMITS.RECONNECT_DELAY * 2 ** exponent,
    LIMITS.RECONNECT_MAX_DELAY
  );

  return { action: "retry", delayMs };
}

/**
 * Human-readable reason for a failed command (Clear, Record, Settings...)
 */
export function describeCommandFailure(
  error: unknown,
  contextInvalidated: boolean
): string {
  if (contextInvalidated || isContextInvalidatedError(error)) {
    return CONTEXT_INVALIDATED_MESSAGE;
  }

  if (error instanceof Error && error.message.startsWith("No response")) {
    return NO_RESPONSE_MESSAGE;
  }

  const detail =
    error instanceof Error ? error.message : String(error ?? "unknown error");
  return `Command failed: ${detail}`;
}

/**
 * Run a command and route its failure to the UI instead of an unhandled
 * rejection. Never throws.
 */
export async function runCommand(
  action: () => Promise<void>,
  report: (message: string) => void,
  isInvalidated: () => boolean = isExtensionContextInvalidated
): Promise<void> {
  try {
    await action();
  } catch (error) {
    console.error("[Strata] Command failed:", error);
    report(describeCommandFailure(error, isInvalidated()));
  }
}
