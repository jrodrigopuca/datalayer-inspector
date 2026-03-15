/**
 * Types for evidence export (PNG/PDF)
 */

import type { EventValidation } from "./schema";

/** Evidence export format */
export const EVIDENCE_FORMAT = {
  PNG: "png",
  PDF: "pdf",
} as const;

export type EvidenceFormat = (typeof EVIDENCE_FORMAT)[keyof typeof EVIDENCE_FORMAT];

/** Evidence export options */
export interface EvidenceOptions {
  /** Export format */
  format: EvidenceFormat;
  /** Scenario/test name for header */
  scenarioName: string;
  /** Whether to show expanded event details */
  expandedView: boolean;
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
export const DEFAULT_EVIDENCE_OPTIONS: Omit<EvidenceOptions, "validations"> = {
  format: EVIDENCE_FORMAT.PDF,
  scenarioName: "DataLayer Evidence",
  expandedView: true,
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
