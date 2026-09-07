/**
 * The per-tab event limit is a HARD stop: nothing is dropped silently, the
 * user clears to continue (docs/TECH-DEBT.md, item 16).
 */

import { type DataLayerEvent, LIMIT_REASON } from "@shared/types";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  addEvent,
  clearAllStates,
  clearEvents,
  getEvents,
  getOrCreateTabState,
  getTabState,
  onLimitReached,
  resetTabState,
  restoreFromStorage,
  setMaxEventsPerTab,
} from "./tab-manager";

const mocked = (fn: unknown): Mock => fn as Mock;

function makeEvent(i: number): Omit<DataLayerEvent, "index"> {
  return {
    id: `evt-${i}`,
    timestamp: 1000 + i,
    url: "https://shop.example/",
    eventName: "custom",
    data: { i },
    containerIds: [],
    source: "dataLayer",
  };
}

describe("tab-manager hard event limit", () => {
  beforeEach(() => {
    clearAllStates();
    mocked(chrome.storage.session.set).mockResolvedValue(undefined);
    mocked(chrome.storage.session.get).mockResolvedValue({});
  });

  it("stores exactly `maxEventsPerTab` events, then refuses the rest", () => {
    setMaxEventsPerTab(3);
    getOrCreateTabState(1);

    const results = [1, 2, 3, 4, 5].map((i) => addEvent(1, makeEvent(i)));

    expect(results.slice(0, 3).every(Boolean)).toBe(true);
    expect(results[3]).toBeNull();
    expect(results[4]).toBeNull();
    expect(getEvents(1).map((e) => e.id)).toEqual(["evt-1", "evt-2", "evt-3"]);
    expect(getTabState(1)?.limitReached).toBe(true);
  });

  it("notifies the listener exactly once, when the limit is hit", () => {
    const listener = vi.fn();
    onLimitReached(listener);
    setMaxEventsPerTab(2);
    getOrCreateTabState(1);

    for (let i = 1; i <= 5; i++) addEvent(1, makeEvent(i));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      tabId: 1,
      reason: LIMIT_REASON.COUNT,
      limit: 2,
      message: "Event limit reached (2). Clear events to keep capturing.",
    });
  });

  it("clearing resets the flag and capture resumes", () => {
    setMaxEventsPerTab(2);
    getOrCreateTabState(1);
    addEvent(1, makeEvent(1));
    addEvent(1, makeEvent(2));
    expect(addEvent(1, makeEvent(3))).toBeNull();

    clearEvents(1);

    expect(getTabState(1)?.limitReached).toBe(false);
    expect(addEvent(1, makeEvent(4))).not.toBeNull();
    expect(getEvents(1).map((e) => e.id)).toEqual(["evt-4"]);
  });

  it("a navigation reset also lifts the limit", () => {
    setMaxEventsPerTab(1);
    getOrCreateTabState(1, "https://a.example/");
    addEvent(1, makeEvent(1));
    expect(getTabState(1)?.limitReached).toBe(true);

    resetTabState(1, "https://b.example/");

    expect(getTabState(1)?.limitReached).toBe(false);
    expect(addEvent(1, makeEvent(2))).not.toBeNull();
  });

  it("restores older stored states without the new fields", async () => {
    mocked(chrome.storage.session.get).mockResolvedValue({
      strata_tab_7: {
        tabId: 7,
        events: [{ ...makeEvent(1), index: 1 }],
        containers: [],
        url: "https://shop.example/",
        isRecording: true,
        nextIndex: 2,
      },
    });

    await restoreFromStorage();

    const state = getTabState(7);
    expect(state?.limitReached).toBe(false);
    expect(state?.approxBytes).toBeGreaterThan(0);
  });
});
