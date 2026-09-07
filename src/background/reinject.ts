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
