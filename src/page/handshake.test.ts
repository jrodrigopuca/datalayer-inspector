import { describe, expect, it } from "vitest";
import { INITIAL_HANDSHAKE_STATE, planHandshake } from "./handshake";

const NAMES = ["dataLayer"];

describe("planHandshake", () => {
  it("first handshake: announce, no replay (the buffer has the history)", () => {
    const plan = planHandshake(INITIAL_HANDSHAKE_STATE, {
      enabled: true,
      dataLayerNames: NAMES,
      relayId: "r1",
    });

    expect(plan).toMatchObject({
      announce: true,
      reannounceContainers: false,
      replay: null,
    });
    expect(plan.next).toEqual({
      announced: true,
      wasEnabled: true,
      lastRelayId: "r1",
    });
  });

  it("same relay re-sending the same state: nothing to do", () => {
    const state = { announced: true, wasEnabled: true, lastRelayId: "r1" };

    const plan = planHandshake(state, {
      enabled: true,
      dataLayerNames: NAMES,
      relayId: "r1",
    });

    expect(plan).toMatchObject({
      announce: false,
      reannounceContainers: false,
      replay: null,
    });
  });

  it("same relay, capture turned on after being off: re-announce containers and replay", () => {
    const state = { announced: true, wasEnabled: false, lastRelayId: "r1" };

    const plan = planHandshake(state, {
      enabled: true,
      dataLayerNames: NAMES,
      relayId: "r1",
    });

    // Only what the worker never received: toggling must not duplicate
    expect(plan.replay).toBe("undelivered");
    // The initial announcement was dropped with the buffer while off
    expect(plan.reannounceContainers).toBe(true);
  });

  it("new relay while enabled (extension reloaded/enabled): re-announce and replay", () => {
    const state = { announced: true, wasEnabled: true, lastRelayId: "r1" };

    const plan = planHandshake(state, {
      enabled: true,
      dataLayerNames: NAMES,
      relayId: "r2",
    });

    expect(plan).toMatchObject({
      announce: false,
      reannounceContainers: true,
      replay: "all",
    });
    expect(plan.next.lastRelayId).toBe("r2");
  });

  it("new relay while disabled: re-announce containers, never replay", () => {
    const state = { announced: true, wasEnabled: true, lastRelayId: "r1" };

    const plan = planHandshake(state, {
      enabled: false,
      dataLayerNames: NAMES,
      relayId: "r2",
    });

    expect(plan.reannounceContainers).toBe(true);
    expect(plan.replay).toBeNull();
  });

  it("first handshake while disabled never replays, and a later enable does", () => {
    const first = planHandshake(INITIAL_HANDSHAKE_STATE, {
      enabled: false,
      dataLayerNames: NAMES,
      relayId: "r1",
    });
    expect(first.replay).toBeNull();

    const later = planHandshake(first.next, {
      enabled: true,
      dataLayerNames: NAMES,
      relayId: "r1",
    });
    expect(later.replay).toBe("undelivered");
  });
});
