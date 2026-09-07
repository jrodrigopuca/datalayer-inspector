/**
 * Export utilities for dataLayer events
 *
 * Provides functions to serialize and download events in various formats.
 *
 * The raw format is the machine-readable twin of the Evidence PDF: it carries
 * everything the panel knows about an event (trigger attribution, category,
 * validation result) so a session can be evaluated without opening DevTools.
 */

import type {
  DataLayerEvent,
  EventTrigger,
  EventValidation,
  ValidationError,
} from "../types";
import { type EventCategory, getEventCategory } from "./event-category";

/** Bump when the raw payload shape changes in a non-additive way */
export const EXPORT_FORMAT_VERSION = 2;

/**
 * Export format options
 */
export interface ExportOptions {
  /** Include internal timestamps */
  readonly includeTimestamp?: boolean;
  /** Include page URL */
  readonly includeUrl?: boolean;
  /** Export format: raw (full data) or clean (just event data) */
  readonly format?: "raw" | "clean";
  /** Validation results by event id (raw format only) */
  readonly validations?: ReadonlyMap<string, EventValidation>;
}

/**
 * Validation outcome for one event, flattened for readers
 */
export interface ExportedValidation {
  readonly status: "pass" | "fail";
  readonly schemas: readonly {
    readonly name: string;
    readonly status: "pass" | "fail";
    readonly errors: readonly ValidationError[];
  }[];
}

/**
 * Exported event structure (clean format)
 */
export interface ExportedEventClean {
  readonly event: string | null;
  readonly data: Record<string, unknown>;
  readonly timestamp?: string;
  readonly url?: string;
}

/**
 * Exported event structure (raw format)
 */
export interface ExportedEventRaw {
  readonly id: string;
  readonly index: number;
  readonly event: string | null;
  readonly category: EventCategory;
  readonly data: Record<string, unknown>;
  readonly containerIds: readonly string[];
  readonly source: string;
  readonly timestamp: string;
  readonly url: string;
  /** What caused the push (null for events captured without attribution) */
  readonly trigger: EventTrigger | null;
  /** Present only when at least one enabled schema matched the event */
  readonly validation?: ExportedValidation;
}

/**
 * Session summary so a reader can judge the export without scanning events
 */
export interface ExportSummary {
  readonly byCategory: Readonly<Record<EventCategory, number>>;
  readonly byTrigger: Readonly<Record<string, number>>;
  /** null when no validation results were supplied */
  readonly validation: {
    readonly passed: number;
    readonly failed: number;
    readonly unchecked: number;
  } | null;
}

/**
 * Full export payload structure
 */
export interface ExportPayload {
  readonly formatVersion: number;
  readonly generator: "Strata";
  readonly exportedAt: string;
  readonly url: string;
  readonly containers: readonly string[];
  readonly totalEvents: number;
  readonly summary: ExportSummary;
  readonly events: readonly (ExportedEventClean | ExportedEventRaw)[];
}

type ResolvedExportOptions = Required<Omit<ExportOptions, "validations">> & {
  readonly validations?: ReadonlyMap<string, EventValidation>;
};

const DEFAULT_OPTIONS: ResolvedExportOptions = {
  includeTimestamp: true,
  includeUrl: true,
  format: "raw",
};

function toExportedValidation(
  validation: EventValidation | undefined
): ExportedValidation | undefined {
  if (!validation || validation.status === "none") return undefined;

  return {
    status: validation.status,
    schemas: validation.results.map((result) => ({
      name: result.schemaName,
      status: result.status,
      errors: result.errors,
    })),
  };
}

/**
 * Transform a single event for export
 */
export function transformEventForExport(
  event: DataLayerEvent,
  options: ResolvedExportOptions
): ExportedEventClean | ExportedEventRaw {
  if (options.format === "clean") {
    return {
      event: event.eventName,
      data: event.data,
      ...(options.includeTimestamp && {
        timestamp: new Date(event.timestamp).toISOString(),
      }),
      ...(options.includeUrl && { url: event.url }),
    };
  }

  // Raw format - include everything the panel knows
  const validation = toExportedValidation(options.validations?.get(event.id));

  return {
    id: event.id,
    index: event.index,
    event: event.eventName,
    category: getEventCategory(event.eventName),
    data: event.data,
    containerIds: event.containerIds,
    source: event.source,
    timestamp: new Date(event.timestamp).toISOString(),
    url: event.url,
    trigger: event.trigger ?? null,
    ...(validation && { validation }),
  };
}

/**
 * Aggregate counts for the payload header
 */
export function summarizeEvents(
  events: readonly DataLayerEvent[],
  validations?: ReadonlyMap<string, EventValidation>
): ExportSummary {
  const byCategory: Record<EventCategory, number> = {
    gtm: 0,
    ecommerce: 0,
    engagement: 0,
    error: 0,
    custom: 0,
  };
  const byTrigger: Record<string, number> = {};

  for (const event of events) {
    byCategory[getEventCategory(event.eventName)]++;
    const triggerType = event.trigger?.type ?? "unknown";
    byTrigger[triggerType] = (byTrigger[triggerType] ?? 0) + 1;
  }

  let validation: ExportSummary["validation"] = null;
  if (validations) {
    let passed = 0;
    let failed = 0;
    let unchecked = 0;
    for (const event of events) {
      const status = validations.get(event.id)?.status ?? "none";
      if (status === "pass") passed++;
      else if (status === "fail") failed++;
      else unchecked++;
    }
    validation = { passed, failed, unchecked };
  }

  return { byCategory, byTrigger, validation };
}

/**
 * Create export payload from events
 */
export function createExportPayload(
  events: readonly DataLayerEvent[],
  containers: readonly string[],
  currentUrl: string,
  options: ExportOptions = {}
): ExportPayload {
  const mergedOptions: ResolvedExportOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    generator: "Strata",
    exportedAt: new Date().toISOString(),
    url: currentUrl,
    containers,
    totalEvents: events.length,
    summary: summarizeEvents(events, mergedOptions.validations),
    events: events.map((e) => transformEventForExport(e, mergedOptions)),
  };
}

/**
 * Serialize export payload to JSON string
 */
export function serializeExport(payload: ExportPayload): string {
  return JSON.stringify(payload, null, 2);
}

/**
 * Generate filename for export
 * Format: datalayer-{domain}-{timestamp}.json
 */
export function generateExportFilename(url: string): string {
  let domain = "unknown";

  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname.replace(/\./g, "-");
  } catch {
    // Invalid URL, use default
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  return `datalayer-${domain}-${timestamp}.json`;
}

/**
 * Trigger browser download of a file
 * Works in both extension contexts and regular pages
 */
export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export events as JSON file (main entry point)
 */
export function exportEventsAsJSON(
  events: readonly DataLayerEvent[],
  containers: readonly string[],
  currentUrl: string,
  options: ExportOptions = {}
): void {
  const payload = createExportPayload(events, containers, currentUrl, options);
  const json = serializeExport(payload);
  const filename = generateExportFilename(currentUrl);

  downloadFile(json, filename);
}
