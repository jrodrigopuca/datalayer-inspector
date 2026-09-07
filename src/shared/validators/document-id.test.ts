import { describe, expect, it } from "vitest";
import {
  CONTENT_MESSAGE_TYPE,
  MESSAGE_SOURCE,
  PAGE_MESSAGE_TYPE,
} from "../types";
import {
  isContentToBackgroundMessage,
  isPageToContentMessage,
} from "./message-validators";

const PAGE_PAYLOAD = {
  id: "e1",
  timestamp: 1,
  url: "https://x.example/",
  eventName: "a",
  data: {},
  containerIds: [],
  sourceName: "dataLayer",
  index: 1,
};

describe("documentId validation", () => {
  it("is optional on page and content event payloads", () => {
    expect(
      isPageToContentMessage({
        source: MESSAGE_SOURCE,
        type: PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
        payload: PAGE_PAYLOAD,
      })
    ).toBe(true);
    expect(
      isPageToContentMessage({
        source: MESSAGE_SOURCE,
        type: PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
        payload: { ...PAGE_PAYLOAD, documentId: "doc" },
      })
    ).toBe(true);
    expect(
      isContentToBackgroundMessage({
        type: CONTENT_MESSAGE_TYPE.EVENT,
        payload: { ...PAGE_PAYLOAD, source: "dataLayer", documentId: "doc" },
      })
    ).toBe(true);
  });

  it("rejects a non-string documentId", () => {
    expect(
      isPageToContentMessage({
        source: MESSAGE_SOURCE,
        type: PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
        payload: { ...PAGE_PAYLOAD, documentId: 42 },
      })
    ).toBe(false);
  });
});
