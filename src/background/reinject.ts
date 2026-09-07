/**
 * Service Worker - Content Script Re-injection
 *
 * Chrome does not inject manifest content scripts into tabs that were
 * already open when the extension is installed, updated or reloaded. The
 * relay living in those tabs belongs to the previous extension version: its
 * chrome.runtime is invalidated and every message it sends fails silently,
 * so the new worker never hears from the page (docs/TECH-DEBT.md, item 17).
 *
 * Fix: on install/update, execute the ISOLATED-world content scripts again
 * in every open http(s) tab. The MAIN-world page script keeps running in
 * the page, so it is never re-injected (that would double-wrap push); the
 * fresh relay's DL_CONFIG handshake simply resumes the flow.
 */

import { STORAGE_KEYS } from "@shared/constants";

interface ContentScriptSpec {
  readonly files: readonly string[];
}

/**
 * Isolated-world content scripts as they exist in the BUILT manifest
 * (bundler-rewritten paths), so re-injection matches what Chrome injects.
 */
export function isolatedContentScripts(
  manifest: chrome.runtime.ManifestV3 = chrome.runtime.getManifest() as chrome.runtime.ManifestV3
): ContentScriptSpec[] {
  const specs: ContentScriptSpec[] = [];
  for (const script of manifest.content_scripts ?? []) {
    if (script.world === "MAIN") continue;
    if (!script.js || script.js.length === 0) continue;
    specs.push({ files: script.js });
  }
  return specs;
}

/**
 * Run the re-injection once per extension process.
 *
 * The worker starts on every wake-up after idling; re-injecting each time
 * would cost one executeScript per open tab per wake. chrome.storage.session
 * lives exactly as long as the extension process (cleared on install,
 * update, reload, disable), so a missing marker means "fresh process":
 * inject and set it; a present marker means "just a wake-up": skip.
 *
 * @returns Number of tabs re-injected, or null when skipped
 */
export async function reinjectOnFreshStart(
  manifest?: chrome.runtime.ManifestV3
): Promise<number | null> {
  const key = STORAGE_KEYS.SESSION_BOOTED;
  try {
    const marker = await chrome.storage.session.get(key);
    if (marker[key] === true) return null;
    await chrome.storage.session.set({ [key]: true });
  } catch (error) {
    console.error("[Strata] Could not read the session marker:", error);
    return null;
  }

  return reinjectContentScripts(manifest);
}

/**
 * Re-inject the isolated content scripts into every open web tab.
 * Restricted pages (chrome://, the Web Store, file:// without access)
 * reject the injection; those are skipped.
 *
 * @returns Number of tabs successfully re-injected
 */
export async function reinjectContentScripts(
  manifest?: chrome.runtime.ManifestV3
): Promise<number> {
  const specs = isolatedContentScripts(manifest);
  if (specs.length === 0) return 0;

  let tabs: chrome.tabs.Tab[];
  try {
    tabs = await chrome.tabs.query({ url: ["http://*/*", "https://*/*"] });
  } catch (error) {
    console.error("[Strata] Could not list tabs for re-injection:", error);
    return 0;
  }

  let injected = 0;
  for (const tab of tabs) {
    if (tab.id === undefined) continue;

    try {
      for (const spec of specs) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [...spec.files],
          world: "ISOLATED",
        });
      }
      injected++;
    } catch {
      // Restricted page or tab gone - nothing to do
    }
  }

  return injected;
}
