import {
  BACKGROUND_TO_CONTENT_TYPE,
  CONTENT_MESSAGE_TYPE,
  MESSAGE_SOURCE,
  PAGE_MESSAGE_TYPE,
} from "@shared/types";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import { setEnabled, startRelay, stopRelay } from "./relay";

const mocked = (fn: unknown): Mock => fn as Mock;

type PageHandler = (event: MessageEvent<unknown>) => void;
type BackgroundHandler = (message: unknown) => void;

const CAPTURED_PAYLOAD = {
  id: "evt-1",
  timestamp: 1000,
  url: "https://shop.example/cart",
  eventName: "add_to_cart",
  data: { event: "add_to_cart", value: 10 },
  containerIds: ["GTM-ABC123"],
  sourceName: "dataLayer",
  index: 3,
};

function pageMessage(type: string, payload: unknown): MessageEvent<unknown> {
  return {
    source: window,
    data: { source: MESSAGE_SOURCE, type, payload },
  } as unknown as MessageEvent<unknown>;
}

describe("relay", () => {
  let pageHandler: PageHandler;
  let backgroundHandler: BackgroundHandler;
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setEnabled(true);
    mocked(chrome.runtime.sendMessage).mockResolvedValue(undefined);
    addEventListenerSpy = vi.spyOn(window, "addEventListener");
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    startRelay();

    const messageCall = addEventListenerSpy.mock.calls.find(
      (call: unknown[]) => call[0] === "message"
    );
    pageHandler = messageCall?.[1] as unknown as PageHandler;
    backgroundHandler = mocked(chrome.runtime.onMessage.addListener).mock
      .calls[0]?.[0] as BackgroundHandler;
  });

  afterEach(() => {
    stopRelay();
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  describe("lifecycle", () => {
    it("registers window and runtime listeners on start", () => {
      expect(pageHandler).toBeTypeOf("function");
      expect(backgroundHandler).toBeTypeOf("function");
    });

    it("removes both listeners on stop", () => {
      stopRelay();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "message",
        pageHandler
      );
      expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalledWith(
        backgroundHandler
      );
    });
  });

  describe("security boundary", () => {
    it("ignores messages not originating from this window", () => {
      pageHandler({
        source: null,
        data: {
          source: MESSAGE_SOURCE,
          type: PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
          payload: CAPTURED_PAYLOAD,
        },
      } as unknown as MessageEvent<unknown>);

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it("ignores messages without the Strata source marker", () => {
      pageHandler({
        source: window,
        data: {
          type: PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
          payload: CAPTURED_PAYLOAD,
        },
      } as unknown as MessageEvent<unknown>);

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it("ignores structurally invalid payloads", () => {
      const { id: _id, ...withoutId } = CAPTURED_PAYLOAD;

      pageHandler(pageMessage(PAGE_MESSAGE_TYPE.EVENT_CAPTURED, withoutId));

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it("ignores unknown message types", () => {
      pageHandler(pageMessage("DL_SOMETHING_ELSE", CAPTURED_PAYLOAD));

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("enabled state", () => {
    it("drops messages while disabled and resumes when enabled", () => {
      setEnabled(false);
      pageHandler(
        pageMessage(PAGE_MESSAGE_TYPE.EVENT_CAPTURED, CAPTURED_PAYLOAD)
      );
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

      setEnabled(true);
      pageHandler(
        pageMessage(PAGE_MESSAGE_TYPE.EVENT_CAPTURED, CAPTURED_PAYLOAD)
      );
      expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(1);
    });

    it("honours SET_ENABLED commands from the background", () => {
      backgroundHandler({
        type: BACKGROUND_TO_CONTENT_TYPE.SET_ENABLED,
        payload: { enabled: false },
      });
      pageHandler(
        pageMessage(PAGE_MESSAGE_TYPE.EVENT_CAPTURED, CAPTURED_PAYLOAD)
      );

      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("message transformation", () => {
    it("relays a captured event as DL_EVENT with `source` renamed", () => {
      pageHandler(
        pageMessage(PAGE_MESSAGE_TYPE.EVENT_CAPTURED, CAPTURED_PAYLOAD)
      );

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: CONTENT_MESSAGE_TYPE.EVENT,
        payload: {
          id: "evt-1",
          timestamp: 1000,
          url: "https://shop.example/cart",
          eventName: "add_to_cart",
          data: { event: "add_to_cart", value: 10 },
          containerIds: ["GTM-ABC123"],
          source: "dataLayer",
          index: 3,
        },
      });
    });

    it("omits the trigger key entirely when the page did not send one", () => {
      pageHandler(
        pageMessage(PAGE_MESSAGE_TYPE.EVENT_CAPTURED, CAPTURED_PAYLOAD)
      );

      const sent = mocked(chrome.runtime.sendMessage).mock.calls[0]?.[0] as {
        payload: Record<string, unknown>;
      };
      expect("trigger" in sent.payload).toBe(false);
    });

    it("forwards trigger attribution when present", () => {
      const trigger = {
        type: "click",
        label: 'button "Add to cart"',
        selector: "#add",
        sinceMs: 120,
      };

      pageHandler(
        pageMessage(PAGE_MESSAGE_TYPE.EVENT_CAPTURED, {
          ...CAPTURED_PAYLOAD,
          trigger,
        })
      );

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ trigger }),
        })
      );
    });

    it("relays detected containers as DL_CONTAINERS", () => {
      const containers = [{ id: "GTM-ABC123", dataLayerName: "dataLayer" }];

      pageHandler(
        pageMessage(PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED, { containers })
      );

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: CONTENT_MESSAGE_TYPE.CONTAINERS,
        payload: { containers },
      });
    });

    it("relays initialization as DL_INIT", () => {
      pageHandler(
        pageMessage(PAGE_MESSAGE_TYPE.INITIALIZED, {
          dataLayerNames: ["dataLayer", "customLayer"],
          existingEventsCount: 4,
        })
      );

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: CONTENT_MESSAGE_TYPE.INIT,
        payload: {
          dataLayerNames: ["dataLayer", "customLayer"],
          existingEventsCount: 4,
        },
      });
    });

    it("swallows delivery failures (service worker asleep)", () => {
      mocked(chrome.runtime.sendMessage).mockRejectedValue(
        new Error("Receiving end does not exist")
      );

      expect(() =>
        pageHandler(
          pageMessage(PAGE_MESSAGE_TYPE.EVENT_CAPTURED, CAPTURED_PAYLOAD)
        )
      ).not.toThrow();
    });
  });
});
