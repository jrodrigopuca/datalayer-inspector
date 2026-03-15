import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createExportPayload,
  serializeExport,
  generateExportFilename,
  transformEventForExport,
} from "./export";
import type { DataLayerEvent } from "../types";

// Fixed date for predictable tests
const FIXED_DATE = new Date("2024-03-15T12:00:00.000Z");
const FIXED_TIMESTAMP = FIXED_DATE.getTime();
const FIXED_ISO = FIXED_DATE.toISOString();

// Mock event factory
function createMockEvent(overrides: Partial<DataLayerEvent> = {}): DataLayerEvent {
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
      data: { key: "value", nested: { foo: "bar" } },
      containerIds: ["GTM-XXXXX"],
      source: "dataLayer",
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
    const payload = {
      exportedAt: "2024-03-15T15:00:00.000Z",
      url: "https://example.com",
      containers: ["GTM-XXXXX"],
      totalEvents: 1,
      events: [{ event: "test", data: {} }],
    };

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
    const filename = generateExportFilename("https://sub.domain.example.co.uk/path");

    expect(filename).toBe("datalayer-sub-domain-example-co-uk-2024-03-15T10-30-45.json");
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
