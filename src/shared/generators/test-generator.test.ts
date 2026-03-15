/**
 * Test generator tests
 */

import { describe, it, expect } from "vitest";
import { generateTestCode, TEST_FRAMEWORK, ASSERTION_STYLE } from "./test-generator";
import type { DataLayerEvent } from "../types";

const mockEvent: DataLayerEvent = {
  id: "evt-1",
  timestamp: 1710500000000,
  url: "https://example.com/checkout",
  index: 0,
  source: "dataLayer",
  eventName: "purchase",
  containerIds: [],
  data: {
    event: "purchase",
    ecommerce: {
      transaction_id: "T12345",
      value: 99.99,
      currency: "USD",
      items: [
        {
          item_id: "SKU123",
          item_name: "Test Product",
          price: 49.99,
          quantity: 2,
        },
      ],
    },
  },
};

const mockEventNoName: DataLayerEvent = {
  id: "evt-2",
  timestamp: 1710500001000,
  url: "https://example.com",
  index: 1,
  source: "dataLayer",
  eventName: null,
  containerIds: [],
  data: {
    userId: "user-123",
    userType: "premium",
  },
};

describe("generateTestCode", () => {
  describe("Playwright generation", () => {
    it("generates basic Playwright test", () => {
      const result = generateTestCode([mockEvent], {
        framework: TEST_FRAMEWORK.PLAYWRIGHT,
        assertionStyle: ASSERTION_STYLE.EXACT,
        includeNavigation: false,
        includeWaits: false,
        testName: "purchase event test",
      });

      expect(result.framework).toBe("playwright");
      expect(result.filename).toBe("datalayer-purchase-event-test.spec.ts");
      expect(result.code).toContain('import { test, expect } from "@playwright/test"');
      expect(result.code).toContain('test("purchase event test"');
      expect(result.code).toContain('e.event === "purchase"');
      expect(result.code).toContain("purchaseEvent");
    });

    it("includes navigation when requested", () => {
      const result = generateTestCode([mockEvent], {
        framework: TEST_FRAMEWORK.PLAYWRIGHT,
        assertionStyle: ASSERTION_STYLE.EXACT,
        includeNavigation: true,
        includeWaits: true,
        testName: "test",
        url: "https://example.com/checkout",
      });

      expect(result.code).toContain('await page.goto("https://example.com/checkout")');
      expect(result.code).toContain('await page.waitForLoadState("networkidle")');
    });

    it("generates exact value assertions", () => {
      const result = generateTestCode([mockEvent], {
        framework: TEST_FRAMEWORK.PLAYWRIGHT,
        assertionStyle: ASSERTION_STYLE.EXACT,
        includeNavigation: false,
        includeWaits: false,
        testName: "test",
      });

      expect(result.code).toContain('expect(purchaseEvent.ecommerce.transaction_id).toBe("T12345")');
      expect(result.code).toContain("expect(purchaseEvent.ecommerce.value).toBe(99.99)");
      expect(result.code).toContain("toHaveLength(1)");
    });

    it("generates type-only assertions", () => {
      const result = generateTestCode([mockEvent], {
        framework: TEST_FRAMEWORK.PLAYWRIGHT,
        assertionStyle: ASSERTION_STYLE.TYPE_ONLY,
        includeNavigation: false,
        includeWaits: false,
        testName: "test",
      });

      expect(result.code).toContain('expect(typeof purchaseEvent.ecommerce.transaction_id).toBe("string")');
      expect(result.code).toContain('expect(typeof purchaseEvent.ecommerce.value).toBe("number")');
    });
  });

  describe("Cypress generation", () => {
    it("generates basic Cypress test", () => {
      const result = generateTestCode([mockEvent], {
        framework: TEST_FRAMEWORK.CYPRESS,
        assertionStyle: ASSERTION_STYLE.EXACT,
        includeNavigation: false,
        includeWaits: false,
        testName: "purchase event test",
      });

      expect(result.framework).toBe("cypress");
      expect(result.filename).toBe("datalayer-purchase-event-test.cy.js");
      expect(result.code).toContain('describe("purchase event test"');
      expect(result.code).toContain("cy.window().then");
      expect(result.code).toContain('e.event === "purchase"');
      expect(result.code).toContain("expect(purchaseEvent).to.exist");
    });

    it("includes navigation when requested", () => {
      const result = generateTestCode([mockEvent], {
        framework: TEST_FRAMEWORK.CYPRESS,
        assertionStyle: ASSERTION_STYLE.EXACT,
        includeNavigation: true,
        includeWaits: true,
        testName: "test",
        url: "https://example.com/checkout",
      });

      expect(result.code).toContain('cy.visit("https://example.com/checkout")');
      expect(result.code).toContain("cy.wait(2000)");
    });

    it("generates exact value assertions", () => {
      const result = generateTestCode([mockEvent], {
        framework: TEST_FRAMEWORK.CYPRESS,
        assertionStyle: ASSERTION_STYLE.EXACT,
        includeNavigation: false,
        includeWaits: false,
        testName: "test",
      });

      expect(result.code).toContain('expect(purchaseEvent.ecommerce.transaction_id).to.equal("T12345")');
      expect(result.code).toContain("expect(purchaseEvent.ecommerce.value).to.equal(99.99)");
      expect(result.code).toContain("to.have.length(1)");
    });

    it("generates type-only assertions", () => {
      const result = generateTestCode([mockEvent], {
        framework: TEST_FRAMEWORK.CYPRESS,
        assertionStyle: ASSERTION_STYLE.TYPE_ONLY,
        includeNavigation: false,
        includeWaits: false,
        testName: "test",
      });

      expect(result.code).toContain('expect(purchaseEvent.ecommerce.transaction_id).to.be.a("string")');
      expect(result.code).toContain('expect(purchaseEvent.ecommerce.value).to.be.a("number")');
    });
  });

  describe("multiple events", () => {
    it("generates assertions for all events", () => {
      const result = generateTestCode([mockEvent, mockEventNoName], {
        framework: TEST_FRAMEWORK.PLAYWRIGHT,
        assertionStyle: ASSERTION_STYLE.EXACT,
        includeNavigation: false,
        includeWaits: false,
        testName: "multiple events test",
      });

      expect(result.code).toContain("purchaseEvent");
      expect(result.code).toContain("pushEvent");
      expect(result.code).toContain("// Assert: purchase event");
      expect(result.code).toContain("// Assert: push event");
    });
  });

  describe("edge cases", () => {
    it("escapes special characters in strings", () => {
      const eventWithSpecialChars: DataLayerEvent = {
        id: "evt-3",
        timestamp: 1710500002000,
        url: "https://example.com",
        index: 2,
        source: "dataLayer",
        eventName: "test",
        containerIds: [],
        data: {
          event: "test",
          message: 'Hello "World"\nNew line',
        },
      };

      const result = generateTestCode([eventWithSpecialChars], {
        framework: TEST_FRAMEWORK.PLAYWRIGHT,
        assertionStyle: ASSERTION_STYLE.EXACT,
        includeNavigation: false,
        includeWaits: false,
        testName: "test",
      });

      expect(result.code).toContain('\\"World\\"');
      expect(result.code).toContain("\\n");
    });

    it("handles null values", () => {
      const eventWithNull: DataLayerEvent = {
        id: "evt-4",
        timestamp: 1710500003000,
        url: "https://example.com",
        index: 3,
        source: "dataLayer",
        eventName: "test",
        containerIds: [],
        data: {
          event: "test",
          value: null,
        },
      };

      const result = generateTestCode([eventWithNull], {
        framework: TEST_FRAMEWORK.PLAYWRIGHT,
        assertionStyle: ASSERTION_STYLE.EXACT,
        includeNavigation: false,
        includeWaits: false,
        testName: "test",
      });

      expect(result.code).toContain("toBeNull()");
    });
  });
});
