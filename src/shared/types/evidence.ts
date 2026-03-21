/**
 * Types for evidence export (PNG/PDF)
 */

import type { EventValidation } from "./schema";

/** Evidence export format */
export const EVIDENCE_FORMAT = {
  PNG: "png",
  PDF: "pdf",
} as const;

export type EvidenceFormat =
  (typeof EVIDENCE_FORMAT)[keyof typeof EVIDENCE_FORMAT];

/** Event view mode for export */
export const EVENT_VIEW_MODE = {
  EXPANDED: "expanded",
  COLLAPSED: "collapsed",
  CUSTOM: "custom",
} as const;

export type EventViewMode =
  (typeof EVENT_VIEW_MODE)[keyof typeof EVENT_VIEW_MODE];

/** Evidence export options */
export interface EvidenceOptions {
  /** Export format */
  format: EvidenceFormat;
  /** Scenario/test name for header */
  scenarioName: string;
  /** Event view mode: all expanded, all collapsed, or custom selection */
  eventViewMode: EventViewMode;
  /** Set of event IDs to expand (used when eventViewMode is 'custom') */
  customExpandedEvents?: ReadonlySet<string>;
  /** Include timestamp in header */
  includeTimestamp: boolean;
  /** Include URL in header */
  includeUrl: boolean;
  /** Include container IDs in header */
  includeContainers: boolean;
  /** Include schema validation status */
  includeValidation: boolean;
  /** Validation results per event (Map<eventId, EventValidation>) */
  validations?: Map<string, EventValidation>;
}

/** Default evidence options */
export const DEFAULT_EVIDENCE_OPTIONS: Omit<
  EvidenceOptions,
  "validations" | "customExpandedEvents"
> = {
  format: EVIDENCE_FORMAT.PDF,
  scenarioName: "DataLayer Evidence",
  eventViewMode: EVENT_VIEW_MODE.EXPANDED,
  includeTimestamp: true,
  includeUrl: true,
  includeContainers: true,
  includeValidation: true,
};

/** Generated evidence result */
export interface GeneratedEvidence {
  /** The blob data */
  blob: Blob;
  /** Suggested filename */
  filename: string;
  /** MIME type */
  mimeType: string;
}
