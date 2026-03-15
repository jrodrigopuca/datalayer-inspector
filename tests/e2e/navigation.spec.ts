/**
 * E2E Tests: SPA Navigation
 *
 * Tests dataLayer capture during client-side navigation:
 * - Virtual pageviews in SPAs
 * - History pushState/popstate handling
 * - Event capture across route changes
 */

import { test, expect, getFixtureUrl } from "./fixtures";

test.describe("SPA Navigation", () => {
  test("TC-E2E-NAV-001: Should capture initial page view on SPA load", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("spa-navigation.html"));
    await page.waitForTimeout(500);

    // Check for initial page_view event
    const initialPageView = await page.evaluate(() => {
      const dl = (
        window as unknown as {
          dataLayer?: Array<{
            event?: string;
            navigation_type?: string;
          }>;
        }
      ).dataLayer;
      return dl?.find(
        (e) => e.event === "page_view" && e.navigation_type === "initial"
      );
    });

    expect(initialPageView).toBeDefined();
  });

  test("TC-E2E-NAV-002: Should capture virtual pageview on SPA navigation", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("spa-navigation.html"));
    await page.waitForTimeout(500);

    // Navigate to Products page
    await page.click('nav a[data-page="products"]');
    await page.waitForTimeout(300);

    // Check for SPA page_view event
    const spaPageView = await page.evaluate(() => {
      const dl = (
        window as unknown as {
          dataLayer?: Array<{
            event?: string;
            navigation_type?: string;
            page_path?: string;
          }>;
        }
      ).dataLayer;
      return dl?.find(
        (e) => e.event === "page_view" && e.page_path === "/products"
      );
    });

    expect(spaPageView).toBeDefined();
    expect(spaPageView?.navigation_type).toBe("spa");
  });

  test("TC-E2E-NAV-003: Should capture events after SPA navigation", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("spa-navigation.html"));
    await page.waitForTimeout(500);

    // Navigate to Products
    await page.click('nav a[data-page="products"]');
    await page.waitForTimeout(300);

    // Add item to cart
    await page.click('button:has-text("Add to Cart"):first-of-type');
    await page.waitForTimeout(200);

    // Verify add_to_cart event was captured
    const addToCartEvent = await page.evaluate(() => {
      const dl = (
        window as unknown as {
          dataLayer?: Array<{
            event?: string;
            ecommerce?: { items?: Array<{ item_id?: string }> };
          }>;
        }
      ).dataLayer;
      return dl?.find((e) => e.event === "add_to_cart");
    });

    expect(addToCartEvent).toBeDefined();
    expect(addToCartEvent?.ecommerce?.items?.[0]?.item_id).toBe("WIDGET-PRO");
  });

  test("TC-E2E-NAV-004: Should capture popstate navigation events", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("spa-navigation.html"));
    await page.waitForTimeout(500);

    // Navigate forward
    await page.click('nav a[data-page="products"]');
    await page.waitForTimeout(300);

    await page.click('nav a[data-page="cart"]');
    await page.waitForTimeout(300);

    // Go back
    await page.goBack();
    await page.waitForTimeout(300);

    // Check for popstate page_view
    const popstatePageView = await page.evaluate(() => {
      const dl = (
        window as unknown as {
          dataLayer?: Array<{
            event?: string;
            navigation_type?: string;
          }>;
        }
      ).dataLayer;
      return dl?.filter((e) => e.navigation_type === "popstate");
    });

    expect(popstatePageView?.length).toBeGreaterThanOrEqual(1);
  });

  test("TC-E2E-NAV-005: Should capture full checkout flow in SPA", async ({
    context,
  }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("spa-navigation.html"));
    await page.waitForTimeout(500);

    // Go to products
    await page.click('nav a[data-page="products"]');
    await page.waitForTimeout(300);

    // Add items
    const addButtons = page.locator('button:has-text("Add to Cart")');
    await addButtons.first().click();
    await page.waitForTimeout(200);

    // Go to cart
    await page.click('nav a[data-page="cart"]');
    await page.waitForTimeout(300);

    // Begin checkout
    await page.click('button:has-text("Proceed to Checkout")');
    await page.waitForTimeout(300);

    // Check for begin_checkout event
    const checkoutEvent = await page.evaluate(() => {
      const dl = (
        window as unknown as {
          dataLayer?: Array<{
            event?: string;
          }>;
        }
      ).dataLayer;
      return dl?.find((e) => e.event === "begin_checkout");
    });

    expect(checkoutEvent).toBeDefined();
  });

  test("TC-E2E-NAV-006: Should handle URL hash changes", async ({ context }) => {
    const page = await context.newPage();
    await page.goto(getFixtureUrl("spa-navigation.html"));
    await page.waitForTimeout(500);

    // Check URL updates with hash
    await page.click('nav a[data-page="products"]');
    await page.waitForTimeout(200);

    const url = page.url();
    expect(url).toContain("#products");
  });
});
