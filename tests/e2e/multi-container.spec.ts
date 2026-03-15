/**
 * E2E Tests: Multi-Container Support
 *
 * Tests pages with multiple GTM containers:
 * - Detecting multiple containers
 * - Capturing events from different dataLayer arrays
 */

import { test, expect, getFixtureUrl } from "./fixtures";

test.describe("Multi-Container Support", () => {
  test("TC-E2E-MULTI-001: Should detect multiple GTM containers", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("gtm-multi-container.html"));
    await page.waitForTimeout(500);

    // Check both containers are detected
    const containers = await page.evaluate(() => {
      const gtm = (
        window as unknown as { google_tag_manager?: Record<string, unknown> }
      ).google_tag_manager;
      return gtm ? Object.keys(gtm).filter((k) => k.startsWith("GTM-")) : [];
    });

    expect(containers).toContain("GTM-AAAA01");
    expect(containers).toContain("GTM-BBBB02");
    expect(containers).toHaveLength(2);
  });

  test("TC-E2E-MULTI-002: Should capture events from primary dataLayer", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("gtm-multi-container.html"));
    await page.waitForTimeout(500);

    // Push to dataLayer (container 1)
    await page.click("#push-dl1-pageview");
    await page.waitForTimeout(200);

    // Verify event in dataLayer
    const dl1Event = await page.evaluate(() => {
      const dl = (
        window as unknown as {
          dataLayer?: Array<{ event?: string; container?: string }>;
        }
      ).dataLayer;
      return dl?.find(
        (e) => e.event === "page_view" && e.container === "GTM-AAAA01"
      );
    });

    expect(dl1Event).toBeDefined();
  });

  test("TC-E2E-MULTI-003: Should capture events from secondary dataLayer", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("gtm-multi-container.html"));
    await page.waitForTimeout(500);

    // Push to dataLayer2 (container 2)
    await page.click("#push-dl2-pageview");
    await page.waitForTimeout(200);

    // Verify event in dataLayer2
    const dl2Event = await page.evaluate(() => {
      const dl2 = (
        window as unknown as {
          dataLayer2?: Array<{ event?: string; container?: string }>;
        }
      ).dataLayer2;
      return dl2?.find(
        (e) => e.event === "page_view" && e.container === "GTM-BBBB02"
      );
    });

    expect(dl2Event).toBeDefined();
  });

  test("TC-E2E-MULTI-004: Should capture ecommerce from different containers", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("gtm-multi-container.html"));
    await page.waitForTimeout(500);

    // Push ecommerce to both dataLayers
    await page.click("#push-dl1-ecommerce");
    await page.waitForTimeout(200);

    await page.click("#push-dl2-ecommerce");
    await page.waitForTimeout(200);

    // Check dataLayer has USD event
    const dl1Ecommerce = await page.evaluate(() => {
      const dl = (
        window as unknown as {
          dataLayer?: Array<{
            event?: string;
            ecommerce?: { currency?: string };
          }>;
        }
      ).dataLayer;
      return dl?.find(
        (e) => e.event === "add_to_cart" && e.ecommerce?.currency === "USD"
      );
    });

    // Check dataLayer2 has EUR event
    const dl2Ecommerce = await page.evaluate(() => {
      const dl2 = (
        window as unknown as {
          dataLayer2?: Array<{
            event?: string;
            ecommerce?: { currency?: string };
          }>;
        }
      ).dataLayer2;
      return dl2?.find(
        (e) => e.event === "add_to_cart" && e.ecommerce?.currency === "EUR"
      );
    });

    expect(dl1Ecommerce).toBeDefined();
    expect(dl2Ecommerce).toBeDefined();
  });

  test("TC-E2E-MULTI-005: Should maintain separate event counts per dataLayer", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("gtm-multi-container.html"));
    await page.waitForTimeout(500);

    // Get initial counts (both have gtm.js)
    const initialCounts = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
      const dl2 = (window as unknown as { dataLayer2?: unknown[] }).dataLayer2;
      return { dl1: dl?.length || 0, dl2: dl2?.length || 0 };
    });

    // Push 3 events to DL1
    await page.click("#push-dl1-pageview");
    await page.click("#push-dl1-event");
    await page.click("#push-dl1-ecommerce");
    await page.waitForTimeout(200);

    // Push 1 event to DL2
    await page.click("#push-dl2-pageview");
    await page.waitForTimeout(200);

    // Verify counts
    const finalCounts = await page.evaluate(() => {
      const dl = (window as unknown as { dataLayer?: unknown[] }).dataLayer;
      const dl2 = (window as unknown as { dataLayer2?: unknown[] }).dataLayer2;
      return { dl1: dl?.length || 0, dl2: dl2?.length || 0 };
    });

    expect(finalCounts.dl1).toBe(initialCounts.dl1 + 3);
    expect(finalCounts.dl2).toBe(initialCounts.dl2 + 1);
  });
});
