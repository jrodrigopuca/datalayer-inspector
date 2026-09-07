/**
 * Page Script - Entry Point
 *
 * Runs in the page's MAIN world as a manifest content script at
 * document_start (no injection, immune to the page's CSP). Intercepts
 * dataLayer.push() and reports to the isolated-world relay.
 *
 * Startup contract (docs/TECH-DEBT.md, item 5):
 * - Intercept the default dataLayer immediately, without waiting for anyone.
 * - Buffer everything until the relay's DL_CONFIG handshake arrives; then
 *   intercept any extra dataLayer names and flush.
 * - Events already in the array are reported in order but marked "preload":
 *   their real push time is unknown and we never pretend otherwise.
 *
 * CRITICAL REQUIREMENTS:
 * - Zero impact on page performance
 * - Silent failure on errors
 * - No global pollution
 */

import { listenForConfig } from "./config";
import {
  detectContainers,
  getContainerIds,
  shouldRedetectContainers,
} from "./container-detector";
import { INITIAL_HANDSHAKE_STATE, planHandshake } from "./handshake";
import { startInteractionTracking } from "./interaction-tracker";
import {
  interceptDataLayer,
  replayExisting,
  setContainerIds,
} from "./interceptor";
import type { CapturedEventData } from "./message-emitter";
import {
  configureEmitter,
  emitContainers,
  emitEvent,
  emitInitialized,
} from "./message-emitter";

const DEFAULT_DATALAYER_NAMES: readonly string[] = ["dataLayer"];

/** Array names already intercepted (idempotent across config updates) */
const interceptedNames = new Set<string>();

/** Events found in arrays before interception, across all names */
let existingEventsTotal = 0;

function handleCapturedEvent(event: CapturedEventData): void {
  // Re-detect containers on gtm.js event
  if (shouldRedetectContainers(event.eventName)) {
    const containers = detectContainers();
    setContainerIds(getContainerIds());
    emitContainers(containers);
  }

  emitEvent(event);
}

function interceptNames(names: readonly string[]): void {
  for (const name of names) {
    if (interceptedNames.has(name)) continue;
    interceptedNames.add(name);
    existingEventsTotal += interceptDataLayer(name, handleCapturedEvent);
  }
}

/**
 * Initialize page script
 */
function init(): void {
  try {
    // Track user interactions so pushes can be attributed to them
    startInteractionTracking();

    // Detect initial containers
    const initialContainers = detectContainers();
    setContainerIds(getContainerIds());
    if (initialContainers.length > 0) {
      emitContainers(initialContainers);
    }

    // Intercept the default array right away (buffered until handshake)
    interceptNames(DEFAULT_DATALAYER_NAMES);

    // Handshake from the relay: extra names, enabled flag, flush.
    // What else to do is decided by planHandshake (see handshake.ts).
    let handshake = INITIAL_HANDSHAKE_STATE;
    listenForConfig((config) => {
      interceptNames(config.dataLayerNames);

      const plan = planHandshake(handshake, config);
      handshake = plan.next;

      if (plan.announce) {
        emitInitialized([...interceptedNames], existingEventsTotal);
      }

      if (plan.reannounceContainers) {
        const containers = detectContainers();
        if (containers.length > 0) {
          emitContainers(containers);
        }
      }

      configureEmitter({ enabled: config.enabled });

      // The array IS the history GTM keeps: replaying it (as "preload")
      // restores the session after capture was off or the relay is new.
      if (plan.replayHistory) {
        for (const name of interceptedNames) {
          replayExisting(name, handleCapturedEvent);
        }
      }
    });
  } catch {
    // Silent fail - must not break page
  }
}

init();
