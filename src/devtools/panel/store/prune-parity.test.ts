/**
 * Parity test: the service worker (authoritative) and the DevTools panel
 * (mirror) must keep exactly the same window of events for the same
 * sequence and the same limit. See docs/TECH-DEBT.md, item 2.
 */

import {
  clearAllStates,
  getEvents,
  getOrCreateTabState,
  setMaxEventsPerTab,
  addEvent as swAddEvent,
} from "@background/tab-manager";
import type { DataLayerEvent } from "@shared/types";
import { DEFAULT_SETTINGS } from "@shared/types";
import { beforeEach, describe, expect, it } from "vitest";
import { usePanelStore } from "./index";

const TAB_ID = 1;

function makeEvent(i: number): Omit<DataLayerEvent, "index"> {
  return {
    id: `evt-${i}`,
    timestamp: 1000 + i,
    url: "https://shop.example/",
    eventName: i % 2 === 0 ? "add_to_cart" : "gtm.click",
    data: { i },
    containerIds: [],
    source: "dataLayer",
  };
}

describe("prune parity between service worker and panel", () => {
  beforeEach(() => {
    clearAllStates();
    usePanelStore.setState({
      events: [],
      selectedEventId: null,
      validations: new Map(),
    });
  });

  it.each([
    { limit: 10, pushes: 25 },
    { limit: 10, pushes: 10 },
    { limit: 1, pushes: 7 },
    { limit: 500, pushes: 1203 },
  ])("keeps the same ids with limit $limit after $pushes pushes", ({
    limit,
    pushes,
  }) => {
    setMaxEventsPerTab(limit);
    usePanelStore.setState({
      settings: { ...DEFAULT_SETTINGS, maxEventsPerTab: limit },
    });
    getOrCreateTabState(TAB_ID);
    const panelAdd = usePanelStore.getState().addEvent;

    for (let i = 1; i <= pushes; i++) {
      // The worker assigns the index and streams the event to the panel
      const stored = swAddEvent(TAB_ID, makeEvent(i));
      if (stored) panelAdd(stored);
    }

    const swIds = getEvents(TAB_ID).map((e) => e.id);
    const panelIds = usePanelStore.getState().events.map((e) => e.id);

    expect(panelIds).toEqual(swIds);
    expect(swIds.length).toBeLessThanOrEqual(limit);
  });
});
