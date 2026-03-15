import { describe, it, expect, beforeEach } from "vitest";
import {
  getOrCreateTabState,
  getTabState,
  hasTabState,
  addEvent,
  updateContainers,
  setRecording,
  clearEvents,
  resetTabState,
  removeTabState,
  getEvents,
  getContainers,
  clearAllStates,
} from "./tab-manager";
import type { DataLayerEvent } from "@shared/types";

describe("tab-manager", () => {
  beforeEach(() => {
    clearAllStates();
  });

  describe("getOrCreateTabState", () => {
    it("creates new state for unknown tab", () => {
      const state = getOrCreateTabState(1, "https://example.com");

      expect(state.tabId).toBe(1);
      expect(state.url).toBe("https://example.com");
      expect(state.events).toEqual([]);
      expect(state.containers).toEqual([]);
      expect(state.isRecording).toBe(true);
      expect(state.nextIndex).toBe(1);
    });

    it("returns existing state for known tab", () => {
      const state1 = getOrCreateTabState(1, "https://example.com");
      state1.events.push({} as DataLayerEvent);

      const state2 = getOrCreateTabState(1, "https://other.com");

      expect(state2).toBe(state1);
      expect(state2.events).toHaveLength(1);
    });
  });

  describe("addEvent", () => {
    it("adds event with correct index", () => {
      getOrCreateTabState(1);

      const event1 = addEvent(1, {
        id: "e1",
        timestamp: Date.now(),
        url: "https://example.com",
        eventName: "test",
        data: {},
        containerIds: [],
        source: "dataLayer",
      });

      const event2 = addEvent(1, {
        id: "e2",
        timestamp: Date.now(),
        url: "https://example.com",
        eventName: "test2",
        data: {},
        containerIds: [],
        source: "dataLayer",
      });

      expect(event1?.index).toBe(1);
      expect(event2?.index).toBe(2);
    });

    it("returns null when recording is paused", () => {
      getOrCreateTabState(1);
      setRecording(1, false);

      const event = addEvent(1, {
        id: "e1",
        timestamp: Date.now(),
        url: "https://example.com",
        eventName: "test",
        data: {},
        containerIds: [],
        source: "dataLayer",
      });

      expect(event).toBeNull();
      expect(getEvents(1)).toHaveLength(0);
    });

    it("updates tab URL from event", () => {
      getOrCreateTabState(1, "https://old.com");

      addEvent(1, {
        id: "e1",
        timestamp: Date.now(),
        url: "https://new.com",
        eventName: "test",
        data: {},
        containerIds: [],
        source: "dataLayer",
      });

      expect(getTabState(1)?.url).toBe("https://new.com");
    });
  });

  describe("updateContainers", () => {
    it("adds containers without duplicates", () => {
      getOrCreateTabState(1);

      updateContainers(1, ["GTM-AAA", "GTM-BBB"]);
      updateContainers(1, ["GTM-BBB", "GTM-CCC"]);

      const containers = getContainers(1);
      expect(containers).toHaveLength(3);
      expect(containers).toContain("GTM-AAA");
      expect(containers).toContain("GTM-BBB");
      expect(containers).toContain("GTM-CCC");
    });
  });

  describe("clearEvents", () => {
    it("clears events but keeps containers", () => {
      getOrCreateTabState(1);

      addEvent(1, {
        id: "e1",
        timestamp: Date.now(),
        url: "https://example.com",
        eventName: "test",
        data: {},
        containerIds: [],
        source: "dataLayer",
      });
      updateContainers(1, ["GTM-AAA"]);

      clearEvents(1);

      expect(getEvents(1)).toHaveLength(0);
      expect(getContainers(1)).toEqual(["GTM-AAA"]);
    });

    it("resets nextIndex to 1", () => {
      const state = getOrCreateTabState(1);

      addEvent(1, {
        id: "e1",
        timestamp: Date.now(),
        url: "https://example.com",
        eventName: "test",
        data: {},
        containerIds: [],
        source: "dataLayer",
      });

      expect(state.nextIndex).toBe(2);

      clearEvents(1);

      expect(state.nextIndex).toBe(1);
    });
  });

  describe("resetTabState", () => {
    it("resets everything except isRecording", () => {
      const state = getOrCreateTabState(1, "https://old.com");
      state.isRecording = false;

      addEvent(1, {
        id: "e1",
        timestamp: Date.now(),
        url: "https://old.com",
        eventName: "test",
        data: {},
        containerIds: [],
        source: "dataLayer",
        index: 1,
      });
      updateContainers(1, ["GTM-AAA"]);

      resetTabState(1, "https://new.com");

      expect(state.events).toHaveLength(0);
      expect(state.containers).toHaveLength(0);
      expect(state.url).toBe("https://new.com");
      expect(state.nextIndex).toBe(1);
      expect(state.isRecording).toBe(false); // Preserved
    });
  });

  describe("removeTabState", () => {
    it("removes tab state completely", () => {
      getOrCreateTabState(1);

      expect(hasTabState(1)).toBe(true);

      const result = removeTabState(1);

      expect(result).toBe(true);
      expect(hasTabState(1)).toBe(false);
    });

    it("returns false for non-existent tab", () => {
      expect(removeTabState(999)).toBe(false);
    });
  });
});
