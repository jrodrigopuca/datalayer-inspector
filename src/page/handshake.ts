/**
 * Page Script - Handshake Policy
 *
 * Pure decision for every DL_CONFIG the page script receives. Kept out of
 * index.ts so the four situations are testable:
 *
 * - first handshake: announce (DL_INITIALIZED); the buffer holds the rest
 * - same relay, capture turned ON: whatever was buffered or pushed while
 *   off never reached the worker; re-announce containers and replay only
 *   the UNDELIVERED part of the array (so toggling off/on never duplicates)
 * - NEW relay (extension reloaded/enabled): its worker knows nothing about
 *   this tab, so re-announce containers and replay the WHOLE history
 * - anything else: just apply the enabled flag
 */

import type { PageConfigPayload } from "@shared/types";

export interface HandshakeState {
  readonly announced: boolean;
  readonly wasEnabled: boolean | null;
  readonly lastRelayId: string | null;
}

export type ReplayMode =
  /** Fresh worker: everything in the array */
  | "all"
  /** Same worker: only pushes it never received */
  | "undelivered";

export interface HandshakePlan {
  /** Emit DL_INITIALIZED (first handshake only) */
  readonly announce: boolean;
  /** Re-emit detected containers (fresh relay, or turned on after off) */
  readonly reannounceContainers: boolean;
  /** Re-emit array contents as preload events, and which part */
  readonly replay: ReplayMode | null;
  readonly next: HandshakeState;
}

export const INITIAL_HANDSHAKE_STATE: HandshakeState = {
  announced: false,
  wasEnabled: null,
  lastRelayId: null,
};

export function planHandshake(
  state: HandshakeState,
  config: PageConfigPayload
): HandshakePlan {
  const first = !state.announced;
  const newRelay = !first && config.relayId !== state.lastRelayId;
  const turnedOn = config.enabled && state.wasEnabled === false;

  let replay: ReplayMode | null = null;
  if (config.enabled && newRelay) replay = "all";
  else if (turnedOn) replay = "undelivered";

  return {
    announce: first,
    reannounceContainers: newRelay || turnedOn,
    replay,
    next: {
      announced: true,
      wasEnabled: config.enabled,
      lastRelayId: config.relayId,
    },
  };
}
