import { describe, it, expect } from "vitest";
import {
  validateEvent,
  validateEventAgainstSchema,
  schemaMatchesEvent,
  eventToTemplate,
} from "./schema-validator";
import type { Schema, DataLayerEvent, TemplateObject } from "../types";
import { TYPE_PLACEHOLDER } from "../types";

// Helper to create mock events
function createMockEvent(
  data: Record<string, unknown>,
  eventName: string | null = null
): DataLayerEvent {
  return {
    id: "test-event-id",
    timestamp: Date.now(),
    url: "https://example.com",
    eventName,
    data: { event: eventName, ...data },
    containerIds: [],
    source: "dataLayer",
    index: 1,
  };
}

// Helper to create mock schemas
function createMockSchema(
  template: TemplateObject,
  overrides: Partial<Schema> = {}
): Schema {
  return {
    id: "test-schema-id",
    name: "Test Schema",
    template,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe("schemaMatchesEvent", () => {
  it("matches when schema has same event name", () => {
    const schema = createMockSchema({ event: "page_view" });
    const event = createMockEvent({}, "page_view");

    expect(schemaMatchesEvent(schema, event)).toBe(true);
  });

  it("does not match when event names differ", () => {
    const schema = createMockSchema({ event: "purchase" });
    const event = createMockEvent({}, "page_view");

    expect(schemaMatchesEvent(schema, event)).toBe(false);
  });

  it("matches any event when schema has no event key", () => {
    const schema = createMockSchema({ some_field: "@string" });
    const event = createMockEvent({ some_field: "value" }, "any_event");

    expect(schemaMatchesEvent(schema, event)).toBe(true);
  });

  it("matches any event when schema event is @string placeholder", () => {
    const schema = createMockSchema({ event: "@string" });
    const event = createMockEvent({}, "any_event");

    expect(schemaMatchesEvent(schema, event)).toBe(true);
  });
});

describe("validateEventAgainstSchema - type placeholders", () => {
  it("validates @string placeholder", () => {
    const schema = createMockSchema({ event: "test", name: "@string" });
    const validEvent = createMockEvent({ name: "John" }, "test");
    const invalidEvent = createMockEvent({ name: 123 }, "test");

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(invalidEvent, schema).status).toBe("fail");
  });

  it("validates @number placeholder", () => {
    const schema = createMockSchema({ event: "test", price: "@number" });
    const validEvent = createMockEvent({ price: 29.99 }, "test");
    const invalidEvent = createMockEvent({ price: "29.99" }, "test");

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(invalidEvent, schema).status).toBe("fail");
  });

  it("validates @boolean placeholder", () => {
    const schema = createMockSchema({ event: "test", active: "@boolean" });
    const validEvent = createMockEvent({ active: true }, "test");
    const invalidEvent = createMockEvent({ active: "true" }, "test");

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(invalidEvent, schema).status).toBe("fail");
  });

  it("validates @array placeholder", () => {
    const schema = createMockSchema({ event: "test", items: "@array" });
    const validEvent = createMockEvent({ items: [1, 2, 3] }, "test");
    const invalidEvent = createMockEvent({ items: "not an array" }, "test");

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(invalidEvent, schema).status).toBe("fail");
  });

  it("validates @object placeholder", () => {
    const schema = createMockSchema({ event: "test", user: "@object" });
    const validEvent = createMockEvent({ user: { id: 1 } }, "test");
    const invalidEvent = createMockEvent({ user: [1, 2] }, "test");

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(invalidEvent, schema).status).toBe("fail");
  });

  it("validates @any placeholder (accepts anything)", () => {
    const schema = createMockSchema({ event: "test", data: "@any" });

    expect(
      validateEventAgainstSchema(createMockEvent({ data: "string" }, "test"), schema).status
    ).toBe("pass");
    expect(
      validateEventAgainstSchema(createMockEvent({ data: 123 }, "test"), schema).status
    ).toBe("pass");
    expect(
      validateEventAgainstSchema(createMockEvent({ data: null }, "test"), schema).status
    ).toBe("pass");
    expect(
      validateEventAgainstSchema(createMockEvent({ data: { nested: true } }, "test"), schema).status
    ).toBe("pass");
  });
});

describe("validateEventAgainstSchema - literal values", () => {
  it("validates exact string match", () => {
    const schema = createMockSchema({ event: "scroll", direction: "vertical" });
    const validEvent = createMockEvent({ direction: "vertical" }, "scroll");
    const invalidEvent = createMockEvent({ direction: "horizontal" }, "scroll");

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(invalidEvent, schema).status).toBe("fail");
  });

  it("validates exact number match", () => {
    const schema = createMockSchema({ event: "scroll", threshold: 25 });
    const validEvent = createMockEvent({ threshold: 25 }, "scroll");
    const invalidEvent = createMockEvent({ threshold: 50 }, "scroll");

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(invalidEvent, schema).status).toBe("fail");
  });

  it("validates exact boolean match", () => {
    const schema = createMockSchema({ event: "test", enabled: true });
    const validEvent = createMockEvent({ enabled: true }, "test");
    const invalidEvent = createMockEvent({ enabled: false }, "test");

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(invalidEvent, schema).status).toBe("fail");
  });

  it("validates null literal", () => {
    const schema = createMockSchema({ event: "test", error: null });
    const validEvent = createMockEvent({ error: null }, "test");
    const invalidEvent = createMockEvent({ error: "some error" }, "test");

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(invalidEvent, schema).status).toBe("fail");
  });
});

describe("validateEventAgainstSchema - nested objects", () => {
  it("validates nested object structure", () => {
    const schema = createMockSchema({
      event: "purchase",
      ecommerce: {
        currency: "@string",
        value: "@number",
      },
    });

    const validEvent = createMockEvent(
      { ecommerce: { currency: "USD", value: 99.99 } },
      "purchase"
    );
    const invalidEvent = createMockEvent(
      { ecommerce: { currency: "USD", value: "99.99" } },
      "purchase"
    );

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(invalidEvent, schema).status).toBe("fail");
  });

  it("reports error with correct path for nested fields", () => {
    const schema = createMockSchema({
      event: "purchase",
      ecommerce: {
        currency: "@string",
      },
    });

    const event = createMockEvent(
      { ecommerce: { currency: 123 } },
      "purchase"
    );
    const result = validateEventAgainstSchema(event, schema);

    expect(result.errors[0]!.path).toBe("ecommerce.currency");
  });

  it("fails when nested object is missing", () => {
    const schema = createMockSchema({
      event: "purchase",
      ecommerce: {
        currency: "@string",
      },
    });

    const event = createMockEvent({}, "purchase");
    const result = validateEventAgainstSchema(event, schema);

    expect(result.status).toBe("fail");
    expect(result.errors[0]!.path).toBe("ecommerce");
  });
});

describe("validateEventAgainstSchema - arrays", () => {
  it("validates array with item pattern", () => {
    const schema = createMockSchema({
      event: "purchase",
      items: [
        {
          item_id: "@string",
          price: "@number",
        },
      ],
    });

    const validEvent = createMockEvent(
      {
        items: [
          { item_id: "SKU1", price: 10 },
          { item_id: "SKU2", price: 20 },
        ],
      },
      "purchase"
    );

    const invalidEvent = createMockEvent(
      {
        items: [
          { item_id: "SKU1", price: 10 },
          { item_id: "SKU2", price: "20" }, // Invalid: string instead of number
        ],
      },
      "purchase"
    );

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(invalidEvent, schema).status).toBe("fail");
  });

  it("reports correct path for array item errors", () => {
    const schema = createMockSchema({
      event: "purchase",
      items: [{ price: "@number" }],
    });

    const event = createMockEvent(
      {
        items: [{ price: 10 }, { price: "invalid" }],
      },
      "purchase"
    );

    const result = validateEventAgainstSchema(event, schema);
    expect(result.errors[0]!.path).toBe("items[1].price");
  });

  it("validates empty array when template is empty array", () => {
    const schema = createMockSchema({
      event: "test",
      items: [],
    });

    const validEvent = createMockEvent({ items: [] }, "test");
    const alsoValidEvent = createMockEvent({ items: [1, 2, 3] }, "test");
    const invalidEvent = createMockEvent({ items: "not array" }, "test");

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(alsoValidEvent, schema).status).toBe("pass");
    expect(validateEventAgainstSchema(invalidEvent, schema).status).toBe("fail");
  });
});

describe("validateEventAgainstSchema - missing fields", () => {
  it("fails when required field is missing", () => {
    const schema = createMockSchema({
      event: "test",
      required_field: "@string",
    });

    const event = createMockEvent({}, "test");
    const result = validateEventAgainstSchema(event, schema);

    expect(result.status).toBe("fail");
    expect(result.errors[0]!.path).toBe("required_field");
    expect(result.errors[0]!.message).toBe("Missing required field");
  });

  it("collects all missing field errors", () => {
    const schema = createMockSchema({
      event: "test",
      field1: "@string",
      field2: "@number",
      field3: "@boolean",
    });

    const event = createMockEvent({}, "test");
    const result = validateEventAgainstSchema(event, schema);

    expect(result.errors).toHaveLength(3);
  });
});

describe("validateEvent - multiple schemas", () => {
  it("returns none when no schemas match", () => {
    const schemas = [
      createMockSchema({ event: "purchase" }, { id: "1" }),
      createMockSchema({ event: "add_to_cart" }, { id: "2" }),
    ];

    const event = createMockEvent({}, "page_view");
    const result = validateEvent(event, schemas);

    expect(result.status).toBe("none");
    expect(result.results).toHaveLength(0);
  });

  it("validates against all matching schemas", () => {
    const schemas = [
      createMockSchema({ event: "test", field1: "@string" }, { id: "1", name: "Schema 1" }),
      createMockSchema({ event: "test", field2: "@number" }, { id: "2", name: "Schema 2" }),
    ];

    const event = createMockEvent({ field1: "hello", field2: 123 }, "test");
    const result = validateEvent(event, schemas);

    expect(result.results).toHaveLength(2);
    expect(result.status).toBe("pass");
  });

  it("fails if any matching schema fails", () => {
    const schemas = [
      createMockSchema({ event: "test", field1: "@string" }, { id: "1" }),
      createMockSchema({ event: "test", field2: "@number" }, { id: "2" }),
    ];

    const event = createMockEvent({ field1: "hello", field2: "not a number" }, "test");
    const result = validateEvent(event, schemas);

    expect(result.status).toBe("fail");
  });

  it("ignores disabled schemas", () => {
    const schemas = [
      createMockSchema({ event: "test", field1: "@string" }, { id: "1", enabled: true }),
      createMockSchema({ event: "test", field2: "@number" }, { id: "2", enabled: false }),
    ];

    const event = createMockEvent({ field1: "hello" }, "test");
    const result = validateEvent(event, schemas);

    // Should only validate against schema 1
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.schemaId).toBe("1");
  });
});

describe("eventToTemplate", () => {
  it("converts string values to @string", () => {
    const data = { name: "John", city: "NYC" };
    const template = eventToTemplate(data);

    expect(template.name).toBe(TYPE_PLACEHOLDER.STRING);
    expect(template.city).toBe(TYPE_PLACEHOLDER.STRING);
  });

  it("converts number values to @number", () => {
    const data = { price: 29.99, quantity: 2 };
    const template = eventToTemplate(data);

    expect(template.price).toBe(TYPE_PLACEHOLDER.NUMBER);
    expect(template.quantity).toBe(TYPE_PLACEHOLDER.NUMBER);
  });

  it("converts boolean values to @boolean", () => {
    const data = { active: true, verified: false };
    const template = eventToTemplate(data);

    expect(template.active).toBe(TYPE_PLACEHOLDER.BOOLEAN);
    expect(template.verified).toBe(TYPE_PLACEHOLDER.BOOLEAN);
  });

  it("preserves null values", () => {
    const data = { error: null };
    const template = eventToTemplate(data);

    expect(template.error).toBeNull();
  });

  it("converts nested objects recursively", () => {
    const data = {
      user: {
        name: "John",
        age: 30,
      },
    };
    const template = eventToTemplate(data);

    expect(template.user).toEqual({
      name: TYPE_PLACEHOLDER.STRING,
      age: TYPE_PLACEHOLDER.NUMBER,
    });
  });

  it("converts arrays using first element as pattern", () => {
    const data = {
      items: [
        { id: "SKU1", price: 10 },
        { id: "SKU2", price: 20 },
      ],
    };
    const template = eventToTemplate(data);

    expect(template.items).toEqual([
      {
        id: TYPE_PLACEHOLDER.STRING,
        price: TYPE_PLACEHOLDER.NUMBER,
      },
    ]);
  });

  it("converts empty arrays to empty array template", () => {
    const data = { items: [] };
    const template = eventToTemplate(data);

    expect(template.items).toEqual([]);
  });
});

describe("real-world example: gtm.scrollDepth", () => {
  it("validates scroll depth event", () => {
    const schema = createMockSchema({
      event: "gtm.scrollDepth",
      "gtm.scrollThreshold": "@number",
      "gtm.scrollUnits": "percent",
      "gtm.scrollDirection": "vertical",
      "gtm.triggers": "@string",
    });

    const validEvent = createMockEvent(
      {
        "gtm.scrollThreshold": 25,
        "gtm.scrollUnits": "percent",
        "gtm.scrollDirection": "vertical",
        "gtm.triggers": "116628750_55",
      },
      "gtm.scrollDepth"
    );

    const invalidUnits = createMockEvent(
      {
        "gtm.scrollThreshold": 25,
        "gtm.scrollUnits": "pixels", // Should be "percent"
        "gtm.scrollDirection": "vertical",
        "gtm.triggers": "116628750_55",
      },
      "gtm.scrollDepth"
    );

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
    
    const result = validateEventAgainstSchema(invalidUnits, schema);
    expect(result.status).toBe("fail");
    expect(result.errors[0]!.path).toBe("gtm.scrollUnits");
  });
});

describe("real-world example: GA4 purchase", () => {
  it("validates purchase event with ecommerce items", () => {
    const schema = createMockSchema({
      event: "purchase",
      ecommerce: {
        transaction_id: "@string",
        value: "@number",
        currency: "@string",
        items: [
          {
            item_id: "@string",
            item_name: "@string",
            price: "@number",
            quantity: "@number",
          },
        ],
      },
    });

    const validEvent = createMockEvent(
      {
        ecommerce: {
          transaction_id: "T12345",
          value: 129.99,
          currency: "USD",
          items: [
            { item_id: "SKU1", item_name: "Shirt", price: 29.99, quantity: 2 },
            { item_id: "SKU2", item_name: "Pants", price: 70.01, quantity: 1 },
          ],
        },
      },
      "purchase"
    );

    expect(validateEventAgainstSchema(validEvent, schema).status).toBe("pass");
  });
});
