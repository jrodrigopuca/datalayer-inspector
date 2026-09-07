import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataLayerEvent, EventValidation } from "../types";
import {
  createExportPayload,
  EXPORT_FORMAT_VERSION,
  generateExportFilename,
  serializeExport,
  summarizeEvents,
  transformEventForExport,
} from "./export";

// Fixed date for predictable tests
const FIXED_DATE = new Date("2024-03-15T12:00:00.000Z");
const FIXED_TIMESTAMP = FIXED_DATE.getTime();
const FIXED_ISO = FIXED_DATE.toISOString();

// Mock event factory
function createMockEvent(
  overrides: Partial<DataLayerEvent> = {}
): DataLayerEvent {
  return {
    id: "test-id-123",
    timestamp: FIXED_TIMESTAMP,
    url: "https://example.com/page",
    eventName: "test_event",
    data: { key: "value", nested: { foo: "bar" } },
    containerIds: ["GTM-XXXXX"],
    source: "dataLayer",
    index: 1,
    ...overrides,
  };
}

describe("transformEventForExport", () => {
  const event = createMockEvent();

  it("transforms to raw format with all fields", () => {
    const result = transformEventForExport(event, {
      format: "raw",
      includeTimestamp: true,
      includeUrl: true,
    });

    expect(result).toEqual({
      id: "test-id-123",
      index: 1,
      event: "test_event",
      category: "custom",
      data: { key: "value", nested: { foo: "bar" } },
      containerIds: ["GTM-XXXXX"],
      source: "dataLayer",
      timestamp: FIXED_ISO,
      url: "https://example.com/page",
      trigger: null,
    });
  });

  it("raw format carries the document id when present", () => {
    const result = transformEventForExport(
      createMockEvent({ documentId: "doc-9" }),
      { format: "raw", includeTimestamp: true, includeUrl: true }
    );

    expect(result).toMatchObject({ documentId: "doc-9" });
  });

  it("raw format carries trigger attribution and category", () => {
    const trigger = {
      type: "click",
      label: 'button "Add to cart"',
      selector: "#add",
      sinceMs: 0,
    } as const;
    const result = transformEventForExport(
      createMockEvent({ eventName: "add_to_cart", trigger }),
      { format: "raw", includeTimestamp: true, includeUrl: true }
    );

    expect(result).toMatchObject({ category: "ecommerce", trigger });
  });

  it("raw format includes the validation outcome when one exists", () => {
    const validation: EventValidation = {
      eventId: "test-id-123",
      status: "fail",
      results: [
        {
          schemaId: "s1",
          schemaName: "Purchase",
          status: "fail",
          errors: [{ path: "value", message: "Missing required field" }],
        },
      ],
    };
    const validations = new Map([["test-id-123", validation]]);

    const result = transformEventForExport(event, {
      format: "raw",
      includeTimestamp: true,
      includeUrl: true,
      validations,
    });

    expect(result).toMatchObject({
      validation: {
        status: "fail",
        schemas: [
          {
            name: "Purchase",
            status: "fail",
            errors: [{ path: "value", message: "Missing required field" }],
          },
        ],
      },
    });
  });

  it("raw format omits validation when no schema matched", () => {
    const validations = new Map<string, EventValidation>([
      ["test-id-123", { eventId: "test-id-123", status: "none", results: [] }],
    ]);

    const result = transformEventForExport(event, {
      format: "raw",
      includeTimestamp: true,
      includeUrl: true,
      validations,
    });

    expect(result).not.toHaveProperty("validation");
  });

  it("clean format includes both timestamp and url when requested", () => {
    const result = transformEventForExport(event, {
      format: "clean",
      includeTimestamp: true,
      includeUrl: true,
    });

    expect(result).toEqual({
      event: "test_event",
      data: { key: "value", nested: { foo: "bar" } },
      timestamp: FIXED_ISO,
      url: "https://example.com/page",
    });
  });

  it("transforms to clean format (minimal)", () => {
    const result = transformEventForExport(event, {
      format: "clean",
      includeTimestamp: false,
      includeUrl: false,
    });

    expect(result).toEqual({
      event: "test_event",
      data: { key: "value", nested: { foo: "bar" } },
    });
  });

  it("includes timestamp in clean format when requested", () => {
    const result = transformEventForExport(event, {
      format: "clean",
      includeTimestamp: true,
      includeUrl: false,
    });

    expect(result).toEqual({
      event: "test_event",
      data: { key: "value", nested: { foo: "bar" } },
      timestamp: FIXED_ISO,
    });
  });

  it("handles null eventName", () => {
    const eventWithoutName = createMockEvent({ eventName: null });
    const result = transformEventForExport(eventWithoutName, {
      format: "clean",
      includeTimestamp: false,
      includeUrl: false,
    });

    expect(result.event).toBeNull();
  });
});

describe("createExportPayload", () => {
  const events = [
    createMockEvent({ id: "1", index: 1 }),
    createMockEvent({ id: "2", index: 2, eventName: "page_view" }),
  ];
  const containers = ["GTM-XXXXX", "GTM-YYYYY"];
  const currentUrl = "https://example.com";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T15:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stamps the format version and generator", () => {
    const payload = createExportPayload(events, containers, currentUrl);

    expect(payload.formatVersion).toBe(EXPORT_FORMAT_VERSION);
    expect(payload.generator).toBe("Strata");
  });

  it("summarizes categories, triggers and validation", () => {
    const withTriggers = [
      createMockEvent({
        id: "1",
        eventName: "add_to_cart",
        trigger: { type: "click", label: null, selector: null, sinceMs: 0 },
      }),
      createMockEvent({
        id: "2",
        eventName: "gtm.js",
        trigger: {
          type: "preload",
          label: null,
          selector: null,
          sinceMs: null,
        },
      }),
      createMockEvent({ id: "3", eventName: "my_event" }),
    ];
    const validations = new Map<string, EventValidation>([
      ["1", { eventId: "1", status: "pass", results: [] }],
      ["2", { eventId: "2", status: "fail", results: [] }],
    ]);

    const payload = createExportPayload(withTriggers, containers, currentUrl, {
      validations,
    });

    expect(payload.summary).toEqual({
      byCategory: { gtm: 1, ecommerce: 1, engagement: 0, error: 0, custom: 1 },
      byTrigger: { click: 1, preload: 1, unknown: 1 },
      validation: { passed: 1, failed: 1, unchecked: 1 },
    });
  });

  it("reports validation as null when no results were supplied", () => {
    expect(summarizeEvents(events).validation).toBeNull();
  });

  it("creates payload with default options (raw format)", () => {
    const payload = createExportPayload(events, containers, currentUrl);

    expect(payload.exportedAt).toBe("2024-03-15T15:00:00.000Z");
    expect(payload.url).toBe("https://example.com");
    expect(payload.containers).toEqual(["GTM-XXXXX", "GTM-YYYYY"]);
    expect(payload.totalEvents).toBe(2);
    expect(payload.events).toHaveLength(2);
    // Raw format includes id
    expect(payload.events[0]).toHaveProperty("id");
  });

  it("creates payload with clean format", () => {
    const payload = createExportPayload(events, containers, currentUrl, {
      format: "clean",
    });

    // Clean format doesn't include id
    expect(payload.events[0]).not.toHaveProperty("id");
    expect(payload.events[0]).toHaveProperty("event");
    expect(payload.events[0]).toHaveProperty("data");
  });

  it("handles empty events array", () => {
    const payload = createExportPayload([], containers, currentUrl);

    expect(payload.totalEvents).toBe(0);
    expect(payload.events).toEqual([]);
  });

  it("handles empty containers array", () => {
    const payload = createExportPayload(events, [], currentUrl);

    expect(payload.containers).toEqual([]);
  });
});

describe("serializeExport", () => {
  it("serializes payload to formatted JSON", () => {
    const payload = createExportPayload(
      [createMockEvent()],
      ["GTM-XXXXX"],
      "https://example.com"
    );

    const result = serializeExport(payload);

    expect(result).toContain('"exportedAt"');
    expect(result).toContain('"GTM-XXXXX"');
    // Should be pretty-printed (has newlines)
    expect(result).toContain("\n");
  });
});

describe("generateExportFilename", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T10:30:45.123Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates filename with domain and timestamp", () => {
    const filename = generateExportFilename("https://www.example.com/page");

    expect(filename).toBe("datalayer-www-example-com-2024-03-15T10-30-45.json");
  });

  it("handles domains with multiple dots", () => {
    const filename = generateExportFilename(
      "https://sub.domain.example.co.uk/path"
    );

    expect(filename).toBe(
      "datalayer-sub-domain-example-co-uk-2024-03-15T10-30-45.json"
    );
  });

  it("handles invalid URLs gracefully", () => {
    const filename = generateExportFilename("not-a-valid-url");

    expect(filename).toBe("datalayer-unknown-2024-03-15T10-30-45.json");
  });

  it("handles empty URL", () => {
    const filename = generateExportFilename("");

    expect(filename).toBe("datalayer-unknown-2024-03-15T10-30-45.json");
  });
});
