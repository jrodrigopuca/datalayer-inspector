import { STORAGE_KEYS } from "@shared/constants";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  isolatedContentScripts,
  reinjectContentScripts,
  reinjectOnFreshStart,
} from "./reinject";

const mocked = (fn: unknown): Mock => fn as Mock;

const MANIFEST = {
  manifest_version: 3,
  name: "Strata",
  version: "1.5.0",
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["assets/page-script.js"],
      run_at: "document_start",
      world: "MAIN",
    },
    {
      matches: ["<all_urls>"],
      js: ["assets/content-loader.js"],
      run_at: "document_start",
    },
  ],
} as unknown as chrome.runtime.ManifestV3;

describe("isolatedContentScripts", () => {
  it("keeps only isolated-world scripts with files", () => {
    expect(isolatedContentScripts(MANIFEST)).toEqual([
      { files: ["assets/content-loader.js"] },
    ]);
  });

  it("returns nothing for a manifest without content scripts", () => {
    expect(
      isolatedContentScripts({
        manifest_version: 3,
        name: "x",
        version: "0",
      } as chrome.runtime.ManifestV3)
    ).toEqual([]);
  });
});

describe("reinjectOnFreshStart", () => {
  beforeEach(() => {
    mocked(chrome.scripting.executeScript).mockResolvedValue([]);
    mocked(chrome.tabs.query).mockResolvedValue([{ id: 1 }]);
    mocked(chrome.storage.session.set).mockResolvedValue(undefined);
  });

  it("injects and sets the marker on a fresh extension process", async () => {
    mocked(chrome.storage.session.get).mockResolvedValue({});

    await expect(reinjectOnFreshStart(MANIFEST)).resolves.toBe(1);

    expect(chrome.storage.session.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.SESSION_BOOTED]: true,
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
  });

  it("skips on a plain worker wake-up (marker present)", async () => {
    mocked(chrome.storage.session.get).mockResolvedValue({
      [STORAGE_KEYS.SESSION_BOOTED]: true,
    });

    await expect(reinjectOnFreshStart(MANIFEST)).resolves.toBeNull();

    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    expect(chrome.storage.session.set).not.toHaveBeenCalled();
  });

  it("skips safely when session storage is unavailable", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocked(chrome.storage.session.get).mockRejectedValue(new Error("nope"));

    await expect(reinjectOnFreshStart(MANIFEST)).resolves.toBeNull();
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("reinjectContentScripts", () => {
  beforeEach(() => {
    mocked(chrome.scripting.executeScript).mockResolvedValue([]);
    mocked(chrome.tabs.query).mockResolvedValue([
      { id: 1, url: "https://shop.example/" },
      { id: 2, url: "https://pay.example/" },
      { url: "https://no-id.example/" },
    ]);
  });

  it("injects the isolated script into every web tab, never the MAIN one", async () => {
    const count = await reinjectContentScripts(MANIFEST);

    expect(count).toBe(2);
    expect(chrome.tabs.query).toHaveBeenCalledWith({
      url: ["http://*/*", "https://*/*"],
    });
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
    expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 1 },
      files: ["assets/content-loader.js"],
      world: "ISOLATED",
    });
    for (const call of mocked(chrome.scripting.executeScript).mock.calls) {
      expect((call[0] as { files: string[] }).files).not.toContain(
        "assets/page-script.js"
      );
    }
  });

  it("skips tabs that reject the injection and keeps going", async () => {
    mocked(chrome.scripting.executeScript)
      .mockRejectedValueOnce(new Error("Cannot access a chrome:// URL"))
      .mockResolvedValue([]);

    const count = await reinjectContentScripts(MANIFEST);

    expect(count).toBe(1);
  });

  it("does nothing when there is no isolated script to inject", async () => {
    const count = await reinjectContentScripts({
      manifest_version: 3,
      name: "x",
      version: "0",
      content_scripts: [MANIFEST.content_scripts?.[0]],
    } as unknown as chrome.runtime.ManifestV3);

    expect(count).toBe(0);
    expect(chrome.tabs.query).not.toHaveBeenCalled();
  });

  it("survives a failing tabs.query", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocked(chrome.tabs.query).mockRejectedValue(new Error("boom"));

    await expect(reinjectContentScripts(MANIFEST)).resolves.toBe(0);
    errorSpy.mockRestore();
  });
});
