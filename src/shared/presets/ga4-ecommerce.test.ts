/**
 * GA4 ecommerce preset tests
 *
 * Guards that every built-in preset is a valid, matchable schema:
 * a spec-compliant event must pass, a broken one must fail.
 */

import { describe, expect, it } from "vitest";
import type { DataLayerEvent } from "../types";
import { createSchema } from "../types";
import {
  schemaMatchesEvent,
  validateEventAgainstSchema,
} from "../validators/schema-validator";
import { GA4_ECOMMERCE_PRESETS } from "./ga4-ecommerce";

function makeEvent(data: Record<string, unknown>): DataLayerEvent {
  return {
    id: "test-id",
    timestamp: Date.now(),
    url: "https://shop.example.com/checkout",
    eventName: typeof data.event === "string" ? data.event : null,
    data,
    containerIds: ["GTM-XXXXX"],
    source: "dataLayer",
    index: 1,
  };
}

const VALID_ITEMS = [
  { item_id: "SKU123", item_name: "Blue Shirt", price: 29.99, quantity: 1 },
];

describe("GA4_ECOMMERCE_PRESETS", () => {
  it("contains the core funnel events", () => {
    const names = GA4_ECOMMERCE_PRESETS.map((p) => p.name).join(" ");
    for (const eventName of [
      "view_item",
      "add_to_cart",
      "begin_checkout",
      "purchase",
    ]) {
      expect(names).toContain(eventName);
    }
  });

  it("every preset only matches its own event name", () => {
    // Generic ecommerce payload: nested-object templates only match when
    // the object is present in the event data
    const ecommerce = {
      transaction_id: "T1",
      currency: "USD",
      value: 1,
      items: VALID_ITEMS,
    };

    for (const preset of GA4_ECOMMERCE_PRESETS) {
      const schema = createSchema(preset);
      const eventName = (preset.template as { event: string }).event;

      const matching = makeEvent({ event: eventName, ecommerce });
      const other = makeEvent({
        event: "totally_unrelated_event",
        ecommerce,
      });

      expect(schemaMatchesEvent(schema, matching)).toBe(true);
      expect(schemaMatchesEvent(schema, other)).toBe(false);
    }
  });

  it("a spec-compliant purchase passes the purchase preset", () => {
    const preset = GA4_ECOMMERCE_PRESETS.find((p) =>
      p.name.includes("purchase")
    );
    expect(preset).toBeDefined();
    if (!preset) return;

    const schema = createSchema(preset);
    const event = makeEvent({
      event: "purchase",
      ecommerce: {
        transaction_id: "T12345",
        currency: "USD",
        value: 99.99,
        items: VALID_ITEMS,
      },
    });

    const result = validateEventAgainstSchema(event, schema);
    expect(result.status).toBe("pass");
    expect(result.errors).toHaveLength(0);
  });

  it("a purchase missing transaction_id fails the purchase preset", () => {
    const preset = GA4_ECOMMERCE_PRESETS.find((p) =>
      p.name.includes("purchase")
    );
    expect(preset).toBeDefined();
    if (!preset) return;

    const schema = createSchema(preset);
    const event = makeEvent({
      event: "purchase",
      ecommerce: {
        currency: "USD",
        value: 99.99,
        items: VALID_ITEMS,
      },
    });

    const result = validateEventAgainstSchema(event, schema);
    expect(result.status).toBe("fail");
    expect(result.errors.some((e) => e.path.includes("transaction_id"))).toBe(
      true
    );
  });

  it("a valid add_to_cart passes the add_to_cart preset", () => {
    const preset = GA4_ECOMMERCE_PRESETS.find((p) =>
      p.name.includes("add_to_cart")
    );
    expect(preset).toBeDefined();
    if (!preset) return;

    const schema = createSchema(preset);
    const event = makeEvent({
      event: "add_to_cart",
      ecommerce: {
        currency: "EUR",
        value: 29.99,
        items: VALID_ITEMS,
      },
    });

    expect(validateEventAgainstSchema(event, schema).status).toBe("pass");
  });
});
