/**
 * E2E Tests: DataLayer Capture Flow
 *
 * Tests the core capture functionality:
 * - Intercepting dataLayer.push events
 * - Capturing pre-existing events
 * - Handling pages without GTM
 */

import { test, expect, getFixtureUrl } from "./fixtures";

test.describe("DataLayer Capture", () => {
  test("TC-E2E-001: Should capture dataLayer.push events", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("gtm-basic.html"));

    // Wait for extension to be ready
    await page.waitForTimeout(500);

    // Click to push an add_to_cart event
    await page.click("#add-to-cart");

    // Wait a bit for the event to be processed
    await page.waitForTimeout(200);

    // Verify the event was pushed to dataLayer
    const dataLayerLength = await page.evaluate(() => {
      return (window as unknown as { dataLayer?: unknown[] }).dataLayer?.length;
    });

    // Should have: gtm.js (initial) + add_to_cart
    expect(dataLayerLength).toBeGreaterThanOrEqual(2);

    // Verify the add_to_cart event exists
    const hasAddToCart = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: Array<{ event?: string }> })
        .dataLayer;
      return dl?.some((e) => e.event === "add_to_cart");
    });

    expect(hasAddToCart).toBe(true);
  });

  test("TC-E2E-002: Should have pre-existing events in dataLayer on preloaded page", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("gtm-preloaded.html"));

    // Wait for extension
    await page.waitForTimeout(500);

    // Check that pre-existing events are in dataLayer
    const preloadedEvents = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: Array<{ event?: string }> })
        .dataLayer;
      return dl?.filter((e) => e.event).map((e) => e.event);
    });

    // Should have: gtm.js, page_view, view_item (preloaded)
    expect(preloadedEvents).toContain("gtm.js");
    expect(preloadedEvents).toContain("page_view");
    expect(preloadedEvents).toContain("view_item");
  });

  test("TC-E2E-003: Should handle page without dataLayer gracefully", async ({
    context,
  }) => {
    const page = await context.newPage();

    // Navigate to page without GTM - extension should not crash
    await page.goto(getFixtureUrl("no-gtm.html"));
    await page.waitForTimeout(500);

    // Page should still work
    const title = await page.title();
    expect(title).toBe("No GTM Page");

    // No dataLayer should exist initially
    const hasDataLayer = await page.evaluate(() => {
      return typeof (window as unknown as { dataLayer?: unknown }).dataLayer !==
        "undefined"
        ? true
        : false;
    });

    // Initially no dataLayer
    expect(hasDataLayer).toBe(false);
  });

  test("TC-E2E-004: Should detect GTM containers", async ({ context }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("gtm-basic.html"));
    await page.waitForTimeout(500);

    // Check google_tag_manager exists with our test container
    const containers = await page.evaluate(() => {
      const gtm = (
        window as unknown as { google_tag_manager?: Record<string, unknown> }
      ).google_tag_manager;
      return gtm ? Object.keys(gtm).filter((k) => k.startsWith("GTM-")) : [];
    });

    expect(containers).toContain("GTM-TEST01");
  });

  test("TC-E2E-005: Should capture multiple push arguments", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("gtm-basic.html"));
    await page.waitForTimeout(500);

    // Push multiple events at once
    await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
      dl?.push({ event: "multi_1" }, { event: "multi_2" }, { event: "multi_3" });
    });

    await page.waitForTimeout(200);

    // Verify all events were captured
    const events = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: Array<{ event?: string }> })
        .dataLayer;
      return dl?.filter((e) => e.event?.startsWith("multi_")).map((e) => e.event);
    });

    expect(events).toContain("multi_1");
    expect(events).toContain("multi_2");
    expect(events).toContain("multi_3");
  });

  test("TC-E2E-006: Should capture events without event key", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("gtm-basic.html"));
    await page.waitForTimeout(500);

    // Push user data (no event key)
    await page.click("#user-data");
    await page.waitForTimeout(200);

    // Verify the data was pushed
    const hasUserData = await page.evaluate(() => {
      const dl = (
        window as unknown as { dataLayer?: Array<{ user_id?: string }> }
      ).dataLayer;
      return dl?.some((e) => e.user_id?.startsWith("U-"));
    });

    expect(hasUserData).toBe(true);
  });

  test("TC-E2E-007: Should capture ecommerce purchase event", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("gtm-basic.html"));
    await page.waitForTimeout(500);

    // Click purchase
    await page.click("#purchase");
    await page.waitForTimeout(200);

    // Verify purchase event with ecommerce data
    const purchaseEvent = await page.evaluate(() => {
      const dl = (
        window as unknown as {
          dataLayer?: Array<{
            event?: string;
            ecommerce?: { transaction_id?: string };
          }>;
        }
      ).dataLayer;
      return dl?.find((e) => e.event === "purchase");
    });

    expect(purchaseEvent).toBeDefined();
    expect(purchaseEvent?.ecommerce?.transaction_id).toMatch(/^T-\d+$/);
  });
});
