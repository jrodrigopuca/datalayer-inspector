/**
 * Persistence tests for tab-manager: per-tab keys, byte budget, warnings.
 * See docs/TECH-DEBT.md, item 3.
 */

import { STORAGE_KEYS } from "@shared/constants";
import {
  type DataLayerEvent,
  type MutableTabState,
  STORAGE_WARNING_KIND,
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
import {
  addEvent,
  clearAllStates,
  getEvents,
  getOrCreateTabState,
  hasTabState,
  onStorageWarning,
  removeTabState,
  restoreFromStorage,
  setTabStateByteBudget,
} from "./tab-manager";

const mocked = (fn: unknown): Mock => fn as Mock;

const KEY_TAB_1 = `${STORAGE_KEYS.TAB_STATE_PREFIX}1`;
const KEY_TAB_2 = `${STORAGE_KEYS.TAB_STATE_PREFIX}2`;

function makeEvent(i: number, padding = 0): Omit<DataLayerEvent, "index"> {
  return {
    id: `evt-${i}`,
    timestamp: 1000 + i,
    url: "https://shop.example/",
    eventName: "custom",
    data: { i, pad: "x".repeat(padding) },
    containerIds: [],
    source: "dataLayer",
  };
}

function storedState(tabId: number): MutableTabState {
  return {
    tabId,
    events: [],
    containers: [`GTM-TAB${tabId}`],
    url: `https://tab${tabId}.example/`,
    isRecording: true,
    nextIndex: 1,
  };
}

/** Let the debounced write fire */
async function flushPersist(): Promise<void> {
  await vi.advanceTimersByTimeAsync(150);
}

describe("tab-manager persistence", () => {
  beforeEach(() => {
    clearAllStates();
    vi.useFakeTimers();
    mocked(chrome.storage.session.get).mockResolvedValue({});
    mocked(chrome.storage.session.set).mockResolvedValue(undefined);
    mocked(chrome.storage.session.remove).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("per-tab writes", () => {
    it("writes only the key of the tab that changed", async () => {
      getOrCreateTabState(1);
      getOrCreateTabState(2);
      await flushPersist();
      mocked(chrome.storage.session.set).mockClear();

      addEvent(2, makeEvent(1));
      await flushPersist();

      expect(chrome.storage.session.set).toHaveBeenCalledTimes(1);
      const written = mocked(chrome.storage.session.set).mock.calls[0]?.[0] as
        | Record<string, unknown>
        | undefined;
      expect(Object.keys(written ?? {})).toEqual([KEY_TAB_2]);
      expect(written?.[KEY_TAB_2]).toMatchObject({ tabId: 2 });
    });

    it("coalesces a burst of changes into one write per tab", async () => {
      getOrCreateTabState(1);
      for (let i = 1; i <= 20; i++) addEvent(1, makeEvent(i));

      await flushPersist();

      expect(chrome.storage.session.set).toHaveBeenCalledTimes(1);
      const written = mocked(chrome.storage.session.set).mock.calls[0]?.[0] as
        | Record<string, MutableTabState>
        | undefined;
      expect(written?.[KEY_TAB_1]?.events).toHaveLength(20);
    });

    it("removes the tab's key when the tab is closed", async () => {
      getOrCreateTabState(1);
      await flushPersist();

      removeTabState(1);
      await flushPersist();

      expect(chrome.storage.session.remove).toHaveBeenCalledWith(KEY_TAB_1);
    });
  });

  describe("restoreFromStorage", () => {
    it("rebuilds every tab from its own key and ignores foreign keys", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mocked(chrome.storage.session.get).mockResolvedValue({
        [KEY_TAB_1]: storedState(1),
        [KEY_TAB_2]: storedState(2),
        [STORAGE_KEYS.SETTINGS]: { enabled: true },
        [`${STORAGE_KEYS.TAB_STATE_PREFIX}abc`]: storedState(99),
        [`${STORAGE_KEYS.TAB_STATE_PREFIX}3`]: { garbage: true },
      });

      await restoreFromStorage();

      expect(chrome.storage.session.get).toHaveBeenCalledWith(null);
      expect(hasTabState(1)).toBe(true);
      expect(hasTabState(2)).toBe(true);
      expect(hasTabState(3)).toBe(false);
      expect(hasTabState(99)).toBe(false);
      expect(getOrCreateTabState(2).containers).toEqual(["GTM-TAB2"]);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });

    it("drops the pre-1.5 single-key backup", async () => {
      mocked(chrome.storage.session.get).mockResolvedValue({
        [STORAGE_KEYS.LEGACY_TAB_STATES]: { "1": storedState(1) },
      });

      await restoreFromStorage();

      expect(hasTabState(1)).toBe(false);
      expect(chrome.storage.session.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.LEGACY_TAB_STATES
      );
    });

    it("only restores once", async () => {
      await restoreFromStorage();
      await restoreFromStorage();

      expect(chrome.storage.session.get).toHaveBeenCalledTimes(1);
    });

    it("survives a storage failure", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mocked(chrome.storage.session.get).mockRejectedValue(new Error("boom"));

      await expect(restoreFromStorage()).resolves.toBeUndefined();

      errorSpy.mockRestore();
    });
  });

  describe("byte budget", () => {
    it("drops the oldest events to fit, updates memory and reports it", async () => {
      const listener = vi.fn();
      onStorageWarning(listener);
      // Each padded event is ~200 chars; 10 of them blow a 900-char budget
      setTabStateByteBudget(900);
      getOrCreateTabState(1);
      for (let i = 1; i <= 10; i++) addEvent(1, makeEvent(i, 100));

      await flushPersist();

      const remaining = getEvents(1);
      expect(remaining.length).toBeLessThan(10);
      expect(remaining.at(-1)?.id).toBe("evt-10");
      expect(remaining[0]?.id).not.toBe("evt-1");

      const written = mocked(chrome.storage.session.set).mock.calls[0]?.[0] as
        | Record<string, MutableTabState>
        | undefined;
      expect(written?.[KEY_TAB_1]?.events).toHaveLength(remaining.length);
      expect(JSON.stringify(written?.[KEY_TAB_1]).length).toBeLessThanOrEqual(
        900
      );

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          tabId: 1,
          kind: STORAGE_WARNING_KIND.PRUNED_BY_SIZE,
          droppedCount: 10 - remaining.length,
        })
      );
    });

    it("always keeps the newest event even if it alone exceeds the budget", async () => {
      setTabStateByteBudget(50);
      getOrCreateTabState(1);
      addEvent(1, makeEvent(1, 500));
      addEvent(1, makeEvent(2, 500));

      await flushPersist();

      expect(getEvents(1).map((e) => e.id)).toEqual(["evt-2"]);
      expect(chrome.storage.session.set).toHaveBeenCalledTimes(1);
    });

    it("does not warn while within budget", async () => {
      const listener = vi.fn();
      onStorageWarning(listener);
      getOrCreateTabState(1);
      addEvent(1, makeEvent(1));

      await flushPersist();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("persist failures", () => {
    it("reports a failed write instead of swallowing it", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const listener = vi.fn();
      onStorageWarning(listener);
      mocked(chrome.storage.session.set).mockRejectedValue(
        new Error("QUOTA_BYTES quota exceeded")
      );
      getOrCreateTabState(1);
      addEvent(1, makeEvent(1));

      await flushPersist();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          tabId: 1,
          kind: STORAGE_WARNING_KIND.PERSIST_FAILED,
          droppedCount: 0,
        })
      );
      expect(getEvents(1)).toHaveLength(1);
      errorSpy.mockRestore();
    });

    it("keeps working when the warning listener throws", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      onStorageWarning(() => {
        throw new Error("listener bug");
      });
      setTabStateByteBudget(50);
      getOrCreateTabState(1);
      addEvent(1, makeEvent(1, 500));
      addEvent(1, makeEvent(2, 500));

      await flushPersist();

      expect(chrome.storage.session.set).toHaveBeenCalledTimes(1);
      errorSpy.mockRestore();
    });
  });
});
