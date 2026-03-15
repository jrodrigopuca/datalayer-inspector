import { describe, it, expect, beforeEach } from "vitest";
import {
  interceptDataLayer,
  setContainerIds,
  resetState,
  getEventIndex,
} from "./interceptor";
import type { CapturedEventData } from "./message-emitter";

describe("interceptor", () => {
  let capturedEvents: CapturedEventData[];
  let onEvent: (event: CapturedEventData) => void;

  beforeEach(() => {
    // Reset module state
    resetState();

    // Reset captured events
    capturedEvents = [];
    onEvent = (event) => capturedEvents.push(event);

    // Clean up window
    const win = window as unknown as Record<string, unknown>;
    delete win.dataLayer;
    delete win.testLayer;
  });

  describe("interceptDataLayer", () => {
    it("intercepts existing dataLayer array", () => {
      const win = window as unknown as Record<string, unknown[]>;
      win.dataLayer = [];

      interceptDataLayer("dataLayer", onEvent);

      // Push an event
      win.dataLayer.push({ event: "test_event", value: 123 });

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0]?.eventName).toBe("test_event");
      expect(capturedEvents[0]?.data).toEqual({ event: "test_event", value: 123 });
    });

    it("captures events with correct metadata", () => {
      const win = window as unknown as Record<string, unknown[]>;
      win.dataLayer = [];

      setContainerIds(["GTM-XXXXX"]);
      interceptDataLayer("dataLayer", onEvent);

      win.dataLayer.push({ event: "page_view" });

      const captured = capturedEvents[0];
      expect(captured).toBeDefined();
      expect(captured?.id).toMatch(/^[a-f0-9-]{36}$|^\d+-\w+$/);
      expect(captured?.timestamp).toBeGreaterThan(0);
      expect(captured?.url).toBe(window.location.href);
      expect(captured?.sourceName).toBe("dataLayer");
      expect(captured?.containerIds).toEqual(["GTM-XXXXX"]);
      expect(captured?.index).toBe(1);
    });

    it("processes existing events in array", () => {
      const win = window as unknown as Record<string, unknown[]>;
      win.dataLayer = [
        { event: "existing_1" },
        { event: "existing_2" },
      ];

      const count = interceptDataLayer("dataLayer", onEvent);

      expect(count).toBe(2);
      expect(capturedEvents).toHaveLength(2);
      expect(capturedEvents[0]?.eventName).toBe("existing_1");
      expect(capturedEvents[1]?.eventName).toBe("existing_2");
    });

    it("sets up getter/setter for non-existent array", () => {
      const win = window as unknown as Record<string, unknown[]>;

      interceptDataLayer("testLayer", onEvent);

      // Array doesn't exist yet
      expect(win.testLayer).toBeUndefined();

      // Create the array
      win.testLayer = [];

      // Should be intercepted now
      win.testLayer.push({ event: "delayed_event" });

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0]?.eventName).toBe("delayed_event");
    });

    it("increments event index across multiple pushes", () => {
      const win = window as unknown as Record<string, unknown[]>;
      win.dataLayer = [];

      interceptDataLayer("dataLayer", onEvent);

      win.dataLayer.push({ event: "first" });
      win.dataLayer.push({ event: "second" });
      win.dataLayer.push({ event: "third" });

      expect(capturedEvents[0]?.index).toBe(1);
      expect(capturedEvents[1]?.index).toBe(2);
      expect(capturedEvents[2]?.index).toBe(3);
      expect(getEventIndex()).toBe(3);
    });

    it("handles null event name", () => {
      const win = window as unknown as Record<string, unknown[]>;
      win.dataLayer = [];

      interceptDataLayer("dataLayer", onEvent);

      win.dataLayer.push({ key: "value" }); // No event property

      expect(capturedEvents[0]?.eventName).toBeNull();
    });

    it("ignores non-object pushes", () => {
      const win = window as unknown as Record<string, unknown[]>;
      win.dataLayer = [];

      interceptDataLayer("dataLayer", onEvent);

      win.dataLayer.push("string");
      win.dataLayer.push(123);
      win.dataLayer.push(null);
      win.dataLayer.push(undefined);
      win.dataLayer.push([1, 2, 3]);

      expect(capturedEvents).toHaveLength(0);
    });

    it("ignores function pushes (GTM command queue)", () => {
      const win = window as unknown as Record<string, unknown[]>;
      win.dataLayer = [];

      interceptDataLayer("dataLayer", onEvent);

      win.dataLayer.push(function () {
        // GTM command
      });

      expect(capturedEvents).toHaveLength(0);
    });

    it("does not intercept same array twice", () => {
      const win = window as unknown as Record<string, unknown[]>;
      win.dataLayer = [];

      interceptDataLayer("dataLayer", onEvent);
      interceptDataLayer("dataLayer", onEvent); // Second call

      win.dataLayer.push({ event: "test" });

      // Should only capture once
      expect(capturedEvents).toHaveLength(1);
    });

    it("preserves original push return value", () => {
      const win = window as unknown as Record<string, unknown[]>;
      win.dataLayer = [];

      interceptDataLayer("dataLayer", onEvent);

      const length = win.dataLayer.push({ event: "a" }, { event: "b" });

      expect(length).toBe(2);
      expect(win.dataLayer).toHaveLength(2);
    });

    it("handles circular references in data", () => {
      const win = window as unknown as Record<string, unknown[]>;
      win.dataLayer = [];

      interceptDataLayer("dataLayer", onEvent);

      const circular: Record<string, unknown> = { event: "circular" };
      circular.self = circular;

      win.dataLayer.push(circular);

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0]?.data.self).toBe("[Circular Reference]");
    });
  });
});
