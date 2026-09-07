/**
 * Content Script - Single Relay Guard
 *
 * The worker re-executes the relay in open tabs on a fresh extension start
 * (install, update, reload, enable). Within one extension process the
 * isolated world is shared, so a second execution must not register a second
 * relay: two relays would forward every page message twice.
 *
 * After a reload/enable the isolated world is brand new, so the flag is
 * absent and the fresh relay starts as intended.
 */

const RELAY_FLAG = "__strataRelayActive";

/**
 * Claim the relay slot in this isolated world.
 *
 * @returns true if this execution should start the relay
 */
export function claimRelaySlot(
  scope: Record<string, unknown> = globalThis as unknown as Record<
    string,
    unknown
  >
): boolean {
  if (scope[RELAY_FLAG] === true) {
    return false;
  }
  scope[RELAY_FLAG] = true;
  return true;
}
