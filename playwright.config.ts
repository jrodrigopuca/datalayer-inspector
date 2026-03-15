import { defineConfig } from "@playwright/test";

/**
 * Playwright configuration for Chrome Extension E2E tests
 *
 * Important notes:
 * - Extensions require headed mode (headless: false)
 * - Extensions require persistent context (handled in fixtures.ts)
 * - We use a single worker since extension state is shared
 * - No webServer needed - we use file:// URLs for test fixtures
 */
export default defineConfig({
  testDir: "./tests/e2e",

  // Run tests sequentially - extension state is shared
  fullyParallel: false,
  workers: 1,

  // CI settings
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // Reporters
  reporter: [["html", { open: "never" }], ["list"]],

  // Timeouts
  timeout: 30000,
  expect: {
    timeout: 5000,
  },

  use: {
    // Trace and video for debugging failures
    trace: "on-first-retry",
    video: "on-first-retry",
    screenshot: "only-on-failure",

    // No base URL - we use file:// URLs
    // baseURL is not set intentionally
  },

  // Only Chromium supports extensions
  projects: [
    {
      name: "chromium-extension",
      use: {
        // The actual browser launch with extension is handled in fixtures.ts
        // These are just markers for the project
        browserName: "chromium",
      },
    },
  ],

  // No webServer - tests use local file:// URLs
  // webServer: undefined,
});
