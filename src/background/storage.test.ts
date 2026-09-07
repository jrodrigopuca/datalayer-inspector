import { STORAGE_KEYS } from "@shared/constants";
import { DEFAULT_SETTINGS } from "@shared/types";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  clearSettingsCache,
  getSettings,
  onSettingsChanged,
  resetSettings,
  updateSettings,
} from "./storage";

const mocked = (fn: unknown): Mock => fn as Mock;

type StorageChanges = { [key: string]: chrome.storage.StorageChange };
type ChangeListener = (changes: StorageChanges, areaName: string) => void;

describe("storage", () => {
  beforeEach(() => {
    clearSettingsCache();
    mocked(chrome.storage.sync.get).mockResolvedValue({});
    mocked(chrome.storage.sync.set).mockResolvedValue(undefined);
    mocked(chrome.storage.sync.remove).mockResolvedValue(undefined);
  });

  describe("getSettings", () => {
    it("returns defaults when nothing is stored", async () => {
      const settings = await getSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(chrome.storage.sync.get).toHaveBeenCalledWith(
        STORAGE_KEYS.SETTINGS
      );
    });

    it("merges stored partial settings over defaults", async () => {
      mocked(chrome.storage.sync.get).mockResolvedValue({
        [STORAGE_KEYS.SETTINGS]: { enabled: false, maxEventsPerTab: 50 },
      });

      const settings = await getSettings();

      expect(settings.enabled).toBe(false);
      expect(settings.maxEventsPerTab).toBe(50);
      // Fields missing from storage keep their defaults
      expect(settings.dataLayerNames).toEqual(DEFAULT_SETTINGS.dataLayerNames);
      expect(settings.preserveLog).toBe(DEFAULT_SETTINGS.preserveLog);
    });

    it("caches the result and does not hit storage twice", async () => {
      await getSettings();
      await getSettings();

      expect(chrome.storage.sync.get).toHaveBeenCalledTimes(1);
    });

    it("falls back to defaults when storage throws", async () => {
      mocked(chrome.storage.sync.get).mockRejectedValue(new Error("quota"));

      const settings = await getSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it("re-reads storage after the cache is cleared", async () => {
      await getSettings();
      clearSettingsCache();
      await getSettings();

      expect(chrome.storage.sync.get).toHaveBeenCalledTimes(2);
    });
  });

  describe("updateSettings", () => {
    it("merges the update, persists it and returns the new settings", async () => {
      const updated = await updateSettings({ preserveLog: true });

      expect(updated).toEqual({ ...DEFAULT_SETTINGS, preserveLog: true });
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.SETTINGS]: updated,
      });
    });

    it("updates the cache so the next read reflects the change", async () => {
      await updateSettings({ enabled: false });

      const settings = await getSettings();

      expect(settings.enabled).toBe(false);
      expect(chrome.storage.sync.get).toHaveBeenCalledTimes(1);
    });

    it("rethrows when persistence fails", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mocked(chrome.storage.sync.set).mockRejectedValue(new Error("quota"));

      await expect(updateSettings({ enabled: false })).rejects.toThrow("quota");

      errorSpy.mockRestore();
    });
  });

  describe("resetSettings", () => {
    it("removes the stored key and returns defaults", async () => {
      await updateSettings({ enabled: false });

      const settings = await resetSettings();

      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(chrome.storage.sync.remove).toHaveBeenCalledWith(
        STORAGE_KEYS.SETTINGS
      );
      expect((await getSettings()).enabled).toBe(true);
    });
  });

  describe("onSettingsChanged", () => {
    function registerAndGetListener(callback: (settings: unknown) => void): {
      listener: ChangeListener;
      unsubscribe: () => void;
    } {
      const unsubscribe = onSettingsChanged(callback);
      const listener = mocked(chrome.storage.onChanged.addListener).mock
        .calls[0]?.[0] as ChangeListener;
      return { listener, unsubscribe };
    }

    it("invokes the callback with merged settings on a sync change", () => {
      const callback = vi.fn();
      const { listener } = registerAndGetListener(callback);

      listener(
        { [STORAGE_KEYS.SETTINGS]: { newValue: { enabled: false } } },
        "sync"
      );

      expect(callback).toHaveBeenCalledWith({
        ...DEFAULT_SETTINGS,
        enabled: false,
      });
    });

    it("refreshes the cache from the external change", async () => {
      const { listener } = registerAndGetListener(vi.fn());

      listener(
        { [STORAGE_KEYS.SETTINGS]: { newValue: { maxEventsPerTab: 10 } } },
        "sync"
      );

      expect((await getSettings()).maxEventsPerTab).toBe(10);
      expect(chrome.storage.sync.get).not.toHaveBeenCalled();
    });

    it("ignores changes in other storage areas or other keys", () => {
      const callback = vi.fn();
      const { listener } = registerAndGetListener(callback);

      listener(
        { [STORAGE_KEYS.SETTINGS]: { newValue: { enabled: false } } },
        "local"
      );
      listener({ [STORAGE_KEYS.SCHEMAS]: { newValue: [] } }, "sync");

      expect(callback).not.toHaveBeenCalled();
    });

    it("returns an unsubscribe function that removes the listener", () => {
      const { listener, unsubscribe } = registerAndGetListener(vi.fn());

      unsubscribe();

      expect(chrome.storage.onChanged.removeListener).toHaveBeenCalledWith(
        listener
      );
    });
  });
});
