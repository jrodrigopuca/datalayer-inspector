/**
 * Page Script - Handshake Policy
 *
 * Pure decision for every DL_CONFIG the page script receives. Kept out of
 * index.ts so the four situations are testable:
 *
 * - first handshake: announce (DL_INITIALIZED); the buffer holds the rest
 * - same relay, capture turned ON: the buffer (containers included) was
 *   dropped while off, so re-announce containers and replay the array
 *   (history) as preload
 * - NEW relay (extension reloaded/enabled): its worker knows nothing about
 *   this tab, so re-announce containers and replay the history
 * - anything else: just apply the enabled flag
 */

import type { PageConfigPayload } from "@shared/types";

export interface HandshakeState {
  readonly announced: boolean;
  readonly wasEnabled: boolean | null;
  readonly lastRelayId: string | null;
}

export interface HandshakePlan {
  /** Emit DL_INITIALIZED (first handshake only) */
  readonly announce: boolean;
  /** Re-emit detected containers (fresh relay) */
  readonly reannounceContainers: boolean;
  /** Re-emit the array contents as preload events */
  readonly replayHistory: boolean;
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

  return {
    announce: first,
    reannounceContainers: newRelay || turnedOn,
    replayHistory: config.enabled && (turnedOn || newRelay),
    next: {
      announced: true,
      wasEnabled: config.enabled,
      lastRelayId: config.relayId,
    },
  };
}
