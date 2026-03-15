/**
 * Playwright E2E Tests for Chrome Extension
 *
 * Testing Chrome extensions with Playwright requires:
 * 1. Persistent context (not regular browser context)
 * 2. Headed mode (headless: false) - extensions don't work headless
 * 3. Loading extension via --load-extension flag
 *
 * These tests verify the full dataLayer capture flow from page to DevTools.
 */

import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Path to the built extension
const EXTENSION_PATH = path.resolve(__dirname, "../../dist");

// Path to test fixtures
const FIXTURES_PATH = path.resolve(__dirname, "../fixtures/pages");

/**
 * Custom test fixture that provides a browser context with the extension loaded.
 * The extension is loaded once and shared across all tests in a file.
 */
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        "--no-first-run",
        "--disable-default-apps",
      ],
    });

    await use(context);
    await context.close();
  },

  extensionId: async ({ context }, use) => {
    // Get extension ID from service worker
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker");
    }

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
});

export { expect } from "@playwright/test";

/**
 * Helper to get file:// URL for test fixtures
 */
export function getFixtureUrl(filename: string): string {
  return `file://${path.join(FIXTURES_PATH, filename)}`;
}

/**
 * Helper to wait for extension to inject and be ready
 */
export async function waitForExtensionReady(
  page: Awaited<ReturnType<BrowserContext["newPage"]>>,
  timeout = 2000
): Promise<void> {
  // Wait for the extension's content script to inject the page script
  // The page script sets a marker we can check
  await page.waitForFunction(
    () => {
      // Check if our interceptor has been installed
      const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
      if (!dl) return false;
      // Our interceptor wraps push - check if it's wrapped
      return (
        dl.push.toString().includes("native code") === false ||
        typeof (window as unknown as { __STRATA_READY__?: boolean })
          .__STRATA_READY__ !== "undefined"
      );
    },
    { timeout }
  );
}
