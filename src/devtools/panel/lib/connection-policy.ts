/**
 * Connection policy for the DevTools panel (docs/TECH-DEBT.md, item 17)
 *
 * Pure decisions, no React and no Chrome calls beyond an injectable check,
 * so the behaviour that used to be buried in the hook is testable:
 *
 * - The FIRST retry after a disconnect is immediate: the usual cause is
 *   the service worker going idle, and connecting wakes it. Background
 *   windows have throttled timers (up to one per minute), so a 1 s timer
 *   there could leave the panel "Disconnected" for a minute.
 * - Later retries back off exponentially with a cap, forever. The attempt
 *   counter is reset only once a connection proves healthy (initial state
 *   fetched), so a dead worker cannot produce a tight reconnect loop.
 *   `chrome.runtime.id` going missing is a HINT that the extension was
 *   reloaded (observed: the id disappears during the reload and can come
 *   back afterwards, and an orphaned panel may then reach the new worker),
 *   so it drives the message, never the decision to stop.
 * - The reliable signal that this panel is stale is the manifest version:
 *   compare the version read when the panel opened with the current one.
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

export interface ReconnectDecision {
  /** Wait this long before the next attempt (always retries) */
  readonly delayMs: number;
  /** What to tell the user meanwhile, if anything */
  readonly message: string | null;
}

/**
 * Decide the next reconnection attempt after a disconnect.
 *
 * @param attempt - Number of retries already made since the last success
 */
export function decideReconnect(input: {
  readonly attempt: number;
  readonly contextInvalidated: boolean;
}): ReconnectDecision {
  const exponent = Math.max(0, Math.min(input.attempt - 1, 30));
  const delayMs =
    input.attempt <= 0
      ? 0
      : Math.min(
          LIMITS.RECONNECT_DELAY * 2 ** exponent,
          LIMITS.RECONNECT_MAX_DELAY
        );

  return {
    delayMs,
    message: input.contextInvalidated ? CONTEXT_INVALIDATED_MESSAGE : null,
  };
}

/**
 * Version of the extension currently backing this page (null if unknown)
 */
export function readManifestVersion(): string | null {
  try {
    const version = chrome.runtime.getManifest().version;
    return typeof version === "string" && version ? version : null;
  } catch {
    return null;
  }
}

/**
 * Message for a panel that outlived its extension version, or null when
 * the versions match or either is unknown.
 */
export function describeVersionChange(
  bootVersion: string | null,
  currentVersion: string | null
): string | null {
  if (!bootVersion || !currentVersion || bootVersion === currentVersion) {
    return null;
  }
  return `Strata was updated (${bootVersion} → ${currentVersion}) while this panel was open. Close and reopen DevTools to load the new version.`;
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
