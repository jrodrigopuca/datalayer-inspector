import type { DataLayerEvent } from "@shared/types";
import { beforeEach, describe, expect, it } from "vitest";
import { usePanelStore } from "../index";

function makeEvent(i: number): DataLayerEvent {
  return {
    id: `evt-${i}`,
    timestamp: 1000 + i,
    url: "https://shop.example/",
    eventName: "custom",
    data: {},
    containerIds: [],
    source: "dataLayer",
    index: i,
  };
}

describe("events slice", () => {
  beforeEach(() => {
    usePanelStore.setState({
      events: [],
      selectedEventId: null,
      limitReached: false,
    });
  });

  it("appends events in order (the worker enforces the limit)", () => {
    const { addEvent } = usePanelStore.getState();

    for (let i = 1; i <= 3; i++) addEvent(makeEvent(i));

    expect(usePanelStore.getState().events.map((e) => e.id)).toEqual([
      "evt-1",
      "evt-2",
      "evt-3",
    ]);
  });

  it("mirrors the worker's limit flag and clears it with the events", () => {
    const { addEvent, setLimitReached, clearEvents } = usePanelStore.getState();
    addEvent(makeEvent(1));

    setLimitReached(true);
    expect(usePanelStore.getState().limitReached).toBe(true);

    clearEvents();

    const state = usePanelStore.getState();
    expect(state.limitReached).toBe(false);
    expect(state.events).toEqual([]);
    expect(state.selectedEventId).toBeNull();
  });
});
