import { STORAGE_KEYS } from "@shared/constants";
import {
  BACKGROUND_MESSAGE_TYPE,
  BACKGROUND_TO_CONTENT_TYPE,
  CLIENT_REQUEST_TYPE,
  CLIENT_RESPONSE_TYPE,
  CONTENT_MESSAGE_TYPE,
  type DataLayerEvent,
  PORT_NAME,
  TAB_RESET_REASON,
} from "@shared/types";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  handleClientRequest,
  handleContentMessage,
  handleTabNavigation,
  handleTabRemoved,
  toggleExtensionEnabled,
} from "./message-handler";
import { clearAllPorts, registerPort } from "./port-manager";
import { clearSettingsCache } from "./storage";
import {
  addEvent,
  clearAllStates,
  getEvents,
  getOrCreateTabState,
  getTabState,
  hasTabState,
} from "./tab-manager";

const mocked = (fn: unknown): Mock => fn as Mock;

const SENDER_TAB_1 = { tab: { id: 1 } } as chrome.runtime.MessageSender;
const SENDER_NO_TAB = {} as chrome.runtime.MessageSender;

function makeEvent(overrides: Partial<DataLayerEvent> = {}): DataLayerEvent {
  return {
    id: "evt-1",
    timestamp: 1000,
    url: "https://shop.example/cart",
    eventName: "add_to_cart",
    data: { event: "add_to_cart" },
    containerIds: [],
    source: "dataLayer",
    index: 0,
    ...overrides,
  };
}

/** Register a fake devtools port for a tab and return its postMessage spy */
function connectPanel(tabId: number): Mock {
  const postMessage = vi.fn();
  const port = {
    name: PORT_NAME.DEVTOOLS_PANEL,
    postMessage,
    disconnect: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
  } as unknown as chrome.runtime.Port;
  registerPort(port, tabId);
  return postMessage;
}

function storeSettings(partial: Record<string, unknown>): void {
  clearSettingsCache();
  mocked(chrome.storage.sync.get).mockResolvedValue({
    [STORAGE_KEYS.SETTINGS]: partial,
  });
}

describe("message-handler", () => {
  beforeEach(() => {
    clearAllStates();
    clearAllPorts();
    storeSettings({});
    mocked(chrome.storage.sync.set).mockResolvedValue(undefined);
    mocked(chrome.storage.session.set).mockResolvedValue(undefined);
    mocked(chrome.tabs.query).mockResolvedValue([]);
    mocked(chrome.tabs.sendMessage).mockResolvedValue(undefined);
  });

  describe("handleContentMessage", () => {
    it("ignores malformed messages", async () => {
      await handleContentMessage({ type: "DL_EVENT" }, SENDER_TAB_1);

      expect(hasTabState(1)).toBe(false);
    });

    it("ignores messages without a sender tab", async () => {
      await handleContentMessage(
        { type: CONTENT_MESSAGE_TYPE.EVENT, payload: makeEvent() },
        SENDER_NO_TAB
      );

      expect(hasTabState(1)).toBe(false);
    });

    it("drops everything while the extension is disabled", async () => {
      storeSettings({ enabled: false });

      await handleContentMessage(
        { type: CONTENT_MESSAGE_TYPE.EVENT, payload: makeEvent() },
        SENDER_TAB_1
      );

      expect(hasTabState(1)).toBe(false);
    });

    it("stores a captured event and streams it to the tab's panel", async () => {
      const panel = connectPanel(1);

      await handleContentMessage(
        { type: CONTENT_MESSAGE_TYPE.EVENT, payload: makeEvent() },
        SENDER_TAB_1
      );

      const events = getEvents(1);
      expect(events).toHaveLength(1);
      expect(events[0]?.index).toBe(1);
      expect(panel).toHaveBeenCalledWith({
        type: BACKGROUND_MESSAGE_TYPE.NEW_EVENT,
        payload: events[0],
      });
    });

    it("does not broadcast events dropped while recording is paused", async () => {
      const panel = connectPanel(1);
      getOrCreateTabState(1).isRecording = false;

      await handleContentMessage(
        { type: CONTENT_MESSAGE_TYPE.EVENT, payload: makeEvent() },
        SENDER_TAB_1
      );

      expect(getEvents(1)).toHaveLength(0);
      expect(panel).not.toHaveBeenCalled();
    });

    it("merges detected containers and broadcasts the ids", async () => {
      const panel = connectPanel(1);

      await handleContentMessage(
        {
          type: CONTENT_MESSAGE_TYPE.CONTAINERS,
          payload: {
            containers: [
              { id: "GTM-AAA111", dataLayerName: "dataLayer" },
              { id: "G-BBB222", dataLayerName: "dataLayer" },
            ],
          },
        },
        SENDER_TAB_1
      );

      expect(getTabState(1)?.containers).toEqual(["GTM-AAA111", "G-BBB222"]);
      expect(panel).toHaveBeenCalledWith({
        type: BACKGROUND_MESSAGE_TYPE.CONTAINERS_UPDATED,
        payload: { containers: ["GTM-AAA111", "G-BBB222"] },
      });
    });

    it("creates the tab state on init", async () => {
      await handleContentMessage(
        {
          type: CONTENT_MESSAGE_TYPE.INIT,
          payload: { dataLayerNames: ["dataLayer"], existingEventsCount: 0 },
        },
        SENDER_TAB_1
      );

      expect(hasTabState(1)).toBe(true);
    });
  });

  describe("handleClientRequest", () => {
    it("answers ERROR for malformed requests", async () => {
      const response = await handleClientRequest(
        { type: CLIENT_REQUEST_TYPE.GET_EVENTS },
        SENDER_NO_TAB
      );

      expect(response.type).toBe(CLIENT_RESPONSE_TYPE.ERROR);
    });

    it("GET_TAB_STATE creates state for a tab that has none yet", async () => {
      const response = await handleClientRequest(
        { type: CLIENT_REQUEST_TYPE.GET_TAB_STATE, payload: { tabId: 7 } },
        SENDER_NO_TAB
      );

      expect(response).toEqual({
        type: CLIENT_RESPONSE_TYPE.TAB_STATE,
        payload: {
          tabId: 7,
          events: [],
          containers: [],
          url: "",
          isRecording: true,
          nextIndex: 1,
        },
      });
    });

    it("GET_EVENTS and GET_CONTAINERS return the tab's data", async () => {
      getOrCreateTabState(1);
      addEvent(1, makeEvent());
      getTabState(1)?.containers.push("GTM-AAA111");

      const events = await handleClientRequest(
        { type: CLIENT_REQUEST_TYPE.GET_EVENTS, payload: { tabId: 1 } },
        SENDER_NO_TAB
      );
      const containers = await handleClientRequest(
        { type: CLIENT_REQUEST_TYPE.GET_CONTAINERS, payload: { tabId: 1 } },
        SENDER_NO_TAB
      );

      expect(events).toMatchObject({
        type: CLIENT_RESPONSE_TYPE.EVENTS,
        payload: { events: [expect.objectContaining({ id: "evt-1" })] },
      });
      expect(containers).toEqual({
        type: CLIENT_RESPONSE_TYPE.CONTAINERS,
        payload: { containers: ["GTM-AAA111"] },
      });
    });

    it("CLEAR_EVENTS empties the tab and notifies its panel", async () => {
      const panel = connectPanel(1);
      getOrCreateTabState(1);
      addEvent(1, makeEvent());

      const response = await handleClientRequest(
        { type: CLIENT_REQUEST_TYPE.CLEAR_EVENTS, payload: { tabId: 1 } },
        SENDER_NO_TAB
      );

      expect(response).toEqual({ type: CLIENT_RESPONSE_TYPE.OK });
      expect(getEvents(1)).toHaveLength(0);
      expect(panel).toHaveBeenLastCalledWith({
        type: BACKGROUND_MESSAGE_TYPE.TAB_STATE_RESET,
        payload: { tabId: 1, reason: TAB_RESET_REASON.CLEARED },
      });
    });

    it("SET_RECORDING updates the tab and notifies its panel", async () => {
      const panel = connectPanel(1);

      await handleClientRequest(
        {
          type: CLIENT_REQUEST_TYPE.SET_RECORDING,
          payload: { tabId: 1, isRecording: false },
        },
        SENDER_NO_TAB
      );

      expect(getTabState(1)?.isRecording).toBe(false);
      expect(panel).toHaveBeenCalledWith({
        type: BACKGROUND_MESSAGE_TYPE.RECORDING_CHANGED,
        payload: { isRecording: false },
      });
    });

    it("GET_SETTINGS returns the merged settings", async () => {
      storeSettings({ preserveLog: true });

      const response = await handleClientRequest(
        { type: CLIENT_REQUEST_TYPE.GET_SETTINGS },
        SENDER_NO_TAB
      );

      expect(response).toMatchObject({
        type: CLIENT_RESPONSE_TYPE.SETTINGS,
        payload: { preserveLog: true, enabled: true },
      });
    });

    it("UPDATE_SETTINGS without an enabled change does not notify tabs", async () => {
      const panel = connectPanel(1);

      await handleClientRequest(
        {
          type: CLIENT_REQUEST_TYPE.UPDATE_SETTINGS,
          payload: { autoScroll: false },
        },
        SENDER_NO_TAB
      );

      expect(chrome.tabs.query).not.toHaveBeenCalled();
      expect(panel).not.toHaveBeenCalled();
    });

    it("UPDATE_SETTINGS toggling enabled notifies every tab and every client", async () => {
      const panel = connectPanel(1);
      mocked(chrome.tabs.query).mockResolvedValue([
        { id: 1 },
        { id: 2 },
        {}, // tab without id must be skipped
      ]);

      const response = await handleClientRequest(
        {
          type: CLIENT_REQUEST_TYPE.UPDATE_SETTINGS,
          payload: { enabled: false },
        },
        SENDER_NO_TAB
      );

      expect(response).toMatchObject({
        type: CLIENT_RESPONSE_TYPE.SETTINGS,
        payload: { enabled: false },
      });
      const setEnabled = {
        type: BACKGROUND_TO_CONTENT_TYPE.SET_ENABLED,
        payload: { enabled: false },
      };
      expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, setEnabled);
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(2, setEnabled);
      expect(panel).toHaveBeenCalledWith({
        type: BACKGROUND_MESSAGE_TYPE.EXTENSION_ENABLED_CHANGED,
        payload: { enabled: false },
      });
    });

    it("answers ERROR when a handler throws", async () => {
      mocked(chrome.storage.sync.set).mockRejectedValue(new Error("quota"));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await handleClientRequest(
        {
          type: CLIENT_REQUEST_TYPE.UPDATE_SETTINGS,
          payload: { autoScroll: false },
        },
        SENDER_NO_TAB
      );

      expect(response).toEqual({
        type: CLIENT_RESPONSE_TYPE.ERROR,
        payload: { message: "quota" },
      });
      errorSpy.mockRestore();
    });
  });

  describe("handleTabNavigation", () => {
    function seedTab(url: string): void {
      getOrCreateTabState(1, url);
      addEvent(1, makeEvent({ url }));
      getTabState(1)?.containers.push("GTM-AAA111");
    }

    it("ignores tabs with no state", async () => {
      await handleTabNavigation(99, "https://shop.example/");

      expect(hasTabState(99)).toBe(false);
    });

    it("resets everything on cross-origin navigation by default", async () => {
      const panel = connectPanel(1);
      seedTab("https://shop.example/checkout");

      await handleTabNavigation(1, "https://pay.gateway.example/session");

      const state = getTabState(1);
      expect(state?.events).toHaveLength(0);
      expect(state?.containers).toHaveLength(0);
      expect(state?.url).toBe("https://pay.gateway.example/session");
      expect(state?.nextIndex).toBe(1);
      expect(panel).toHaveBeenCalledWith({
        type: BACKGROUND_MESSAGE_TYPE.TAB_STATE_RESET,
        payload: { tabId: 1, reason: TAB_RESET_REASON.NAVIGATION },
      });
    });

    it("keeps events across origins when preserveLog is on", async () => {
      const panel = connectPanel(1);
      storeSettings({ preserveLog: true });
      seedTab("https://shop.example/checkout");

      await handleTabNavigation(1, "https://pay.gateway.example/session");

      const state = getTabState(1);
      expect(state?.events).toHaveLength(1);
      expect(state?.containers).toEqual(["GTM-AAA111"]);
      expect(state?.url).toBe("https://pay.gateway.example/session");
      expect(panel).not.toHaveBeenCalled();
    });

    it("keeps events on same-origin navigation", async () => {
      seedTab("https://shop.example/cart");

      await handleTabNavigation(1, "https://shop.example/checkout");

      const state = getTabState(1);
      expect(state?.events).toHaveLength(1);
      expect(state?.url).toBe("https://shop.example/checkout");
    });

    it("treats an unparsable previous URL as a different origin", async () => {
      seedTab("not a url");

      await handleTabNavigation(1, "https://shop.example/");

      expect(getTabState(1)?.events).toHaveLength(0);
    });
  });

  describe("handleTabRemoved", () => {
    it("drops the tab state", () => {
      getOrCreateTabState(1);

      handleTabRemoved(1);

      expect(hasTabState(1)).toBe(false);
    });
  });

  describe("toggleExtensionEnabled", () => {
    it("flips the flag, persists it and notifies tabs and clients", async () => {
      const panel = connectPanel(1);
      mocked(chrome.tabs.query).mockResolvedValue([{ id: 1 }]);

      const result = await toggleExtensionEnabled();

      expect(result).toBe(false);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.SETTINGS]: expect.objectContaining({ enabled: false }),
      });
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, {
        type: BACKGROUND_TO_CONTENT_TYPE.SET_ENABLED,
        payload: { enabled: false },
      });
      expect(panel).toHaveBeenCalledWith({
        type: BACKGROUND_MESSAGE_TYPE.EXTENSION_ENABLED_CHANGED,
        payload: { enabled: false },
      });
    });
  });
});
