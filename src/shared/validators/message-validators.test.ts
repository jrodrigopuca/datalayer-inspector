import { describe, it, expect } from "vitest";
import {
  isPageToContentMessage,
  isContentToBackgroundMessage,
  isClientToBackgroundRequest,
} from "./message-validators";
import {
  MESSAGE_SOURCE,
  PAGE_MESSAGE_TYPE,
  CONTENT_MESSAGE_TYPE,
  CLIENT_REQUEST_TYPE,
} from "../types";

describe("isPageToContentMessage", () => {
  it("returns false for non-objects", () => {
    expect(isPageToContentMessage(null)).toBe(false);
    expect(isPageToContentMessage(undefined)).toBe(false);
    expect(isPageToContentMessage("string")).toBe(false);
    expect(isPageToContentMessage(123)).toBe(false);
  });

  it("returns false if source is not MESSAGE_SOURCE", () => {
    expect(
      isPageToContentMessage({
        source: "wrong-source",
        type: PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
        payload: {},
      })
    ).toBe(false);
  });

  it("returns false for unknown message types", () => {
    expect(
      isPageToContentMessage({
        source: MESSAGE_SOURCE,
        type: "UNKNOWN_TYPE",
        payload: {},
      })
    ).toBe(false);
  });

  describe("EVENT_CAPTURED", () => {
    const validPayload = {
      id: "test-id",
      timestamp: Date.now(),
      url: "https://example.com",
      eventName: "test_event",
      data: { key: "value" },
      containerIds: ["GTM-XXXXX"],
      sourceName: "dataLayer",
      index: 1,
    };

    it("validates correct EVENT_CAPTURED message", () => {
      expect(
        isPageToContentMessage({
          source: MESSAGE_SOURCE,
          type: PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
          payload: validPayload,
        })
      ).toBe(true);
    });

    it("accepts null eventName", () => {
      expect(
        isPageToContentMessage({
          source: MESSAGE_SOURCE,
          type: PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
          payload: { ...validPayload, eventName: null },
        })
      ).toBe(true);
    });

    it("rejects missing required fields", () => {
      const requiredFields = [
        "id",
        "timestamp",
        "url",
        "data",
        "containerIds",
        "sourceName",
        "index",
      ];

      for (const field of requiredFields) {
        const invalidPayload = { ...validPayload };
        delete (invalidPayload as Record<string, unknown>)[field];

        expect(
          isPageToContentMessage({
            source: MESSAGE_SOURCE,
            type: PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
            payload: invalidPayload,
          })
        ).toBe(false);
      }
    });
  });

  describe("CONTAINERS_DETECTED", () => {
    it("validates correct CONTAINERS_DETECTED message", () => {
      expect(
        isPageToContentMessage({
          source: MESSAGE_SOURCE,
          type: PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED,
          payload: {
            containers: [{ id: "GTM-XXXXX", dataLayerName: "dataLayer" }],
          },
        })
      ).toBe(true);
    });

    it("accepts empty containers array", () => {
      expect(
        isPageToContentMessage({
          source: MESSAGE_SOURCE,
          type: PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED,
          payload: { containers: [] },
        })
      ).toBe(true);
    });

    it("rejects invalid container shape", () => {
      expect(
        isPageToContentMessage({
          source: MESSAGE_SOURCE,
          type: PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED,
          payload: { containers: [{ id: "GTM-XXXXX" }] }, // missing dataLayerName
        })
      ).toBe(false);
    });
  });

  describe("INITIALIZED", () => {
    it("validates correct INITIALIZED message", () => {
      expect(
        isPageToContentMessage({
          source: MESSAGE_SOURCE,
          type: PAGE_MESSAGE_TYPE.INITIALIZED,
          payload: {
            dataLayerNames: ["dataLayer"],
            existingEventsCount: 0,
          },
        })
      ).toBe(true);
    });

    it("rejects non-array dataLayerNames", () => {
      expect(
        isPageToContentMessage({
          source: MESSAGE_SOURCE,
          type: PAGE_MESSAGE_TYPE.INITIALIZED,
          payload: {
            dataLayerNames: "dataLayer",
            existingEventsCount: 0,
          },
        })
      ).toBe(false);
    });
  });
});

describe("isContentToBackgroundMessage", () => {
  it("returns false for non-objects", () => {
    expect(isContentToBackgroundMessage(null)).toBe(false);
    expect(isContentToBackgroundMessage(undefined)).toBe(false);
  });

  describe("DL_EVENT", () => {
    const validEvent = {
      id: "test-id",
      timestamp: Date.now(),
      url: "https://example.com",
      eventName: "test_event",
      data: { key: "value" },
      containerIds: ["GTM-XXXXX"],
      source: "dataLayer",
      index: 1,
    };

    it("validates correct DL_EVENT message", () => {
      expect(
        isContentToBackgroundMessage({
          type: CONTENT_MESSAGE_TYPE.EVENT,
          payload: validEvent,
        })
      ).toBe(true);
    });

    it("rejects invalid event payload", () => {
      expect(
        isContentToBackgroundMessage({
          type: CONTENT_MESSAGE_TYPE.EVENT,
          payload: { id: "test" }, // missing required fields
        })
      ).toBe(false);
    });
  });
});

describe("isClientToBackgroundRequest", () => {
  it("validates GET_EVENTS request", () => {
    expect(
      isClientToBackgroundRequest({
        type: CLIENT_REQUEST_TYPE.GET_EVENTS,
        payload: { tabId: 1 },
      })
    ).toBe(true);
  });

  it("validates SET_RECORDING request", () => {
    expect(
      isClientToBackgroundRequest({
        type: CLIENT_REQUEST_TYPE.SET_RECORDING,
        payload: { tabId: 1, isRecording: true },
      })
    ).toBe(true);
  });

  it("validates GET_SETTINGS request (no payload)", () => {
    expect(
      isClientToBackgroundRequest({
        type: CLIENT_REQUEST_TYPE.GET_SETTINGS,
      })
    ).toBe(true);
  });

  it("validates UPDATE_SETTINGS request", () => {
    expect(
      isClientToBackgroundRequest({
        type: CLIENT_REQUEST_TYPE.UPDATE_SETTINGS,
        payload: { autoScroll: false },
      })
    ).toBe(true);
  });

  it("rejects unknown request types", () => {
    expect(
      isClientToBackgroundRequest({
        type: "UNKNOWN_REQUEST",
        payload: {},
      })
    ).toBe(false);
  });
});
