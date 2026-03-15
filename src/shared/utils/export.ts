/**
 * Export utilities for dataLayer events
 *
 * Provides functions to serialize and download events in various formats
 */

import type { DataLayerEvent } from "../types";

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
  readonly data: Record<string, unknown>;
  readonly containerIds: readonly string[];
  readonly source: string;
  readonly timestamp: string;
  readonly url: string;
}

/**
 * Full export payload structure
 */
export interface ExportPayload {
  readonly exportedAt: string;
  readonly url: string;
  readonly containers: readonly string[];
  readonly totalEvents: number;
  readonly events: readonly (ExportedEventClean | ExportedEventRaw)[];
}

const DEFAULT_OPTIONS: Required<ExportOptions> = {
  includeTimestamp: true,
  includeUrl: true,
  format: "raw",
};

/**
 * Transform a single event for export
 */
export function transformEventForExport(
  event: DataLayerEvent,
  options: Required<ExportOptions>
): ExportedEventClean | ExportedEventRaw {
  if (options.format === "clean") {
    const clean: ExportedEventClean = {
      event: event.eventName,
      data: event.data,
    };

    if (options.includeTimestamp) {
      return { ...clean, timestamp: new Date(event.timestamp).toISOString() };
    }
    if (options.includeUrl) {
      return { ...clean, url: event.url };
    }

    return clean;
  }

  // Raw format - include everything
  return {
    id: event.id,
    index: event.index,
    event: event.eventName,
    data: event.data,
    containerIds: event.containerIds,
    source: event.source,
    timestamp: new Date(event.timestamp).toISOString(),
    url: event.url,
  };
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
  const mergedOptions: Required<ExportOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  return {
    exportedAt: new Date().toISOString(),
    url: currentUrl,
    containers,
    totalEvents: events.length,
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

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19);

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
