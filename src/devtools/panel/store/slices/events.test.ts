import type { DataLayerEvent, EventValidation } from "@shared/types";
import { DEFAULT_SETTINGS } from "@shared/types";
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

function validationFor(id: string): EventValidation {
  return { eventId: id, status: "pass", results: [] };
}

describe("events slice", () => {
  beforeEach(() => {
    usePanelStore.setState({
      events: [],
      selectedEventId: null,
      validations: new Map(),
      settings: { ...DEFAULT_SETTINGS, maxEventsPerTab: 10 },
    });
  });

  it("appends events while under the limit", () => {
    const { addEvent } = usePanelStore.getState();

    for (let i = 1; i <= 10; i++) addEvent(makeEvent(i));

    expect(usePanelStore.getState().events).toHaveLength(10);
  });

  it("never holds more than maxEventsPerTab events", () => {
    const { addEvent } = usePanelStore.getState();

    for (let i = 1; i <= 25; i++) addEvent(makeEvent(i));

    const { events } = usePanelStore.getState();
    expect(events.length).toBeLessThanOrEqual(10);
    // Newest event is always kept
    expect(events.at(-1)?.id).toBe("evt-25");
  });

  it("drops validations of pruned events and keeps the rest", () => {
    const { addEvent } = usePanelStore.getState();

    for (let i = 1; i <= 10; i++) {
      addEvent(makeEvent(i));
      usePanelStore.setState((s) => ({
        validations: new Map(s.validations).set(
          `evt-${i}`,
          validationFor(`evt-${i}`)
        ),
      }));
    }

    // 11th event triggers the prune (limit 10, slack 2 -> keep 8)
    addEvent(makeEvent(11));

    const { events, validations } = usePanelStore.getState();
    const keptIds = new Set(events.map((e) => e.id));
    for (const id of validations.keys()) {
      expect(keptIds.has(id)).toBe(true);
    }
    expect(validations.has("evt-1")).toBe(false);
    expect(validations.has("evt-10")).toBe(true);
  });

  it("clears the selection when the selected event is pruned", () => {
    const { addEvent, selectEvent } = usePanelStore.getState();

    for (let i = 1; i <= 10; i++) addEvent(makeEvent(i));
    selectEvent("evt-1");

    addEvent(makeEvent(11));

    expect(usePanelStore.getState().selectedEventId).toBeNull();
  });

  it("keeps the selection when the selected event survives", () => {
    const { addEvent, selectEvent } = usePanelStore.getState();

    for (let i = 1; i <= 10; i++) addEvent(makeEvent(i));
    selectEvent("evt-10");

    addEvent(makeEvent(11));

    expect(usePanelStore.getState().selectedEventId).toBe("evt-10");
  });

  it("does not touch validations or selection when nothing is pruned", () => {
    const { addEvent, selectEvent } = usePanelStore.getState();
    const validations = new Map([["evt-1", validationFor("evt-1")]]);
    usePanelStore.setState({ validations });
    addEvent(makeEvent(1));
    selectEvent("evt-1");

    addEvent(makeEvent(2));

    const state = usePanelStore.getState();
    expect(state.validations).toBe(validations);
    expect(state.selectedEventId).toBe("evt-1");
  });
});
