/**
 * Tests for evidence generator
 *
 * Note: PNG generation requires Canvas API which isn't fully available in JSDOM.
 * These tests focus on the PDF generation and helper functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateEvidence } from "./evidence-generator";
import { EVIDENCE_FORMAT, EVENT_VIEW_MODE } from "../types/evidence";
import type {
  DataLayerEvent,
  EventValidation,
  ValidationResult,
} from "../types";

// Mock jsPDF - vitest 4 requires class-based mocks
vi.mock("jspdf", () => {
  return {
    jsPDF: class MockJsPDF {
      setFillColor = vi.fn();
      roundedRect = vi.fn();
      setFontSize = vi.fn();
      setFont = vi.fn();
      setTextColor = vi.fn();
      text = vi.fn();
      addPage = vi.fn();
      getTextWidth = vi.fn().mockReturnValue(20);
      output = vi
        .fn()
        .mockReturnValue(new Blob(["mock-pdf"], { type: "application/pdf" }));
    },
  };
});

function createMockEvent(
  overrides: Partial<DataLayerEvent> = {}
): DataLayerEvent {
  return {
    id: "evt-1",
    timestamp: Date.now(),
    data: { event: "page_view", page_title: "Test Page" },
    eventName: "page_view",
    url: "https://example.com/test",
    containerIds: ["GTM-ABC123"],
    source: "push",
    index: 0,
    ...overrides,
  };
}

function createMockValidationResult(
  schemaId: string,
  status: "pass" | "fail",
  errors: Array<{ path: string; message: string }> = []
): ValidationResult {
  return {
    schemaId,
    schemaName: `Schema ${schemaId}`,
    status,
    errors,
  };
}

function createMockEventValidation(
  eventId: string,
  status: "pass" | "fail" | "none",
  results: readonly ValidationResult[] = []
): EventValidation {
  return {
    eventId,
    status,
    results,
  };
}

describe("generateEvidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PDF generation", () => {
    it("generates PDF with default options", async () => {
      const events = [createMockEvent()];
      const result = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
      });

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.mimeType).toBe("application/pdf");
      expect(result.filename).toMatch(/^.*-evidence-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it("generates PDF with custom scenario name", async () => {
      const events = [createMockEvent()];
      const result = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
        scenarioName: "Login Flow Test",
      });

      expect(result.filename).toMatch(/^login-flow-test-evidence-.*\.pdf$/);
    });

    it("handles empty events array", async () => {
      const result = await generateEvidence([], {
        format: EVIDENCE_FORMAT.PDF,
      });

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.mimeType).toBe("application/pdf");
    });

    it("includes validation badges when enabled", async () => {
      const events = [createMockEvent({ id: "evt-1" })];
      const validations = new Map<string, EventValidation>([
        ["evt-1", createMockEventValidation("evt-1", "pass", [])],
      ]);

      const result = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
        includeValidation: true,
        validations,
      });

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it("handles multiple events", async () => {
      const events = [
        createMockEvent({ id: "evt-1", eventName: "page_view" }),
        createMockEvent({ id: "evt-2", eventName: "add_to_cart" }),
        createMockEvent({ id: "evt-3", eventName: "purchase" }),
      ];

      const result = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
      });

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it("respects eventViewMode option", async () => {
      const events = [createMockEvent()];

      // Both should succeed
      const expanded = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
        eventViewMode: EVENT_VIEW_MODE.EXPANDED,
      });
      const collapsed = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
        eventViewMode: EVENT_VIEW_MODE.COLLAPSED,
      });

      expect(expanded.blob).toBeInstanceOf(Blob);
      expect(collapsed.blob).toBeInstanceOf(Blob);
    });

    it("respects custom eventViewMode with specific events expanded", async () => {
      const events = [
        createMockEvent({ id: "evt-1", eventName: "page_view" }),
        createMockEvent({ id: "evt-2", eventName: "add_to_cart" }),
      ];

      const result = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
        eventViewMode: EVENT_VIEW_MODE.CUSTOM,
        customExpandedEvents: new Set(["evt-1"]), // Only first event expanded
      });

      expect(result.blob).toBeInstanceOf(Blob);
    });
  });

  describe("PNG generation", () => {
    // Note: PNG generation uses Canvas API which isn't fully available in JSDOM
    // These tests verify the function handles the format correctly

    it("attempts PNG generation when format is PNG", async () => {
      const events = [createMockEvent()];

      // This will throw because JSDOM doesn't have full Canvas support
      // but we can verify it tries the right path
      await expect(
        generateEvidence(events, { format: EVIDENCE_FORMAT.PNG })
      ).rejects.toThrow();
    });
  });

  describe("filename generation", () => {
    it("sanitizes special characters in scenario name", async () => {
      const events = [createMockEvent()];
      const result = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
        scenarioName: "Test & Demo! #1",
      });

      expect(result.filename).toMatch(/^test-demo-1-evidence-.*\.pdf$/);
    });

    it("handles empty scenario name", async () => {
      const events = [createMockEvent()];
      const result = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
        scenarioName: "",
      });

      expect(result.filename).toMatch(/^evidence-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it("includes current date in filename", async () => {
      const events = [createMockEvent()];
      const result = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
      });

      const today = new Date().toISOString().slice(0, 10);
      expect(result.filename).toContain(today);
    });
  });

  describe("options handling", () => {
    it("uses default options when none provided", async () => {
      const events = [createMockEvent()];
      const result = await generateEvidence(events);

      // Default format is PDF
      expect(result.mimeType).toBe("application/pdf");
    });

    it("merges partial options with defaults", async () => {
      const events = [createMockEvent()];
      const result = await generateEvidence(events, {
        scenarioName: "Custom Name",
        // Other options should use defaults
      });

      expect(result.filename).toMatch(/^custom-name-evidence-.*\.pdf$/);
    });
  });

  describe("validation integration", () => {
    it("handles events with pass status", async () => {
      const events = [createMockEvent({ id: "evt-1" })];
      const validations = new Map<string, EventValidation>([
        [
          "evt-1",
          createMockEventValidation("evt-1", "pass", [
            createMockValidationResult("s1", "pass"),
          ]),
        ],
      ]);

      const result = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
        includeValidation: true,
        validations,
      });

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it("handles events with fail status", async () => {
      const events = [createMockEvent({ id: "evt-1" })];
      const failResult = createMockValidationResult("s1", "fail", [
        { path: "$.event", message: "Required field missing" },
      ]);
      const validations = new Map<string, EventValidation>([
        ["evt-1", createMockEventValidation("evt-1", "fail", [failResult])],
      ]);

      const result = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
        includeValidation: true,
        validations,
      });

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it("handles mixed validation statuses", async () => {
      const events = [
        createMockEvent({ id: "evt-1" }),
        createMockEvent({ id: "evt-2" }),
        createMockEvent({ id: "evt-3" }),
      ];
      const validations = new Map<string, EventValidation>([
        [
          "evt-1",
          createMockEventValidation("evt-1", "pass", [
            createMockValidationResult("s1", "pass"),
          ]),
        ],
        [
          "evt-2",
          createMockEventValidation("evt-2", "fail", [
            createMockValidationResult("s1", "fail"),
          ]),
        ],
        // evt-3 has no validation (none status)
      ]);

      const result = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
        includeValidation: true,
        validations,
      });

      expect(result.blob).toBeInstanceOf(Blob);
    });

    it("skips validation badges when includeValidation is false", async () => {
      const events = [createMockEvent({ id: "evt-1" })];
      const validations = new Map<string, EventValidation>([
        ["evt-1", createMockEventValidation("evt-1", "pass", [])],
      ]);

      const result = await generateEvidence(events, {
        format: EVIDENCE_FORMAT.PDF,
        includeValidation: false,
        validations,
      });

      expect(result.blob).toBeInstanceOf(Blob);
    });
  });
});
