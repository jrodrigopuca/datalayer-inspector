/**
 * Evidence generator - Creates PDF evidence from dataLayer events
 *
 * PDF-only by design: PDF paginates, so captures of any length work.
 * (PNG was removed: single-canvas rendering silently fails beyond the
 * browser's ~32k px canvas limit, which long sessions always exceed.)
 */

import { jsPDF } from "jspdf";
import type { DataLayerEvent } from "../types/events";
import type { EvidenceOptions, GeneratedEvidence } from "../types/evidence";
import { DEFAULT_EVIDENCE_OPTIONS, EVENT_VIEW_MODE } from "../types/evidence";
import { formatTriggerFull } from "../utils/trigger-format";

/**
 * Trigger line for an event, or null when disabled/absent
 */
function getTriggerLine(
  event: DataLayerEvent,
  options: EvidenceOptions
): string | null {
  if (!options.includeTrigger || !event.trigger) return null;
  return `Trigger: ${formatTriggerFull(event.trigger)}`;
}

/**
 * Determine if an event should be expanded based on view mode
 */
function shouldExpandEvent(
  event: DataLayerEvent,
  options: EvidenceOptions
): boolean {
  switch (options.eventViewMode) {
    case EVENT_VIEW_MODE.EXPANDED:
      return true;
    case EVENT_VIEW_MODE.COLLAPSED:
      return false;
    case EVENT_VIEW_MODE.CUSTOM:
      return options.customExpandedEvents?.has(event.id) ?? false;
  }
}

/** Syntax highlighting colors (VS Code dark theme inspired) */
const COLORS = {
  text: "#cccccc",
  key: "#9cdcfe",
  string: "#ce9178",
  number: "#b5cea8",
  boolean: "#569cd6",
  null: "#569cd6",
  bracket: "#ffd700",
};

/** PDF configuration */
const PDF_CONFIG = {
  pageWidth: 210, // A4 width in mm
  pageHeight: 297, // A4 height in mm
  margin: 15,
  lineHeight: 5,
  fontSize: {
    title: 14,
    header: 10,
    body: 8,
    code: 7,
  },
};

/**
 * Generate evidence from events
 */
export async function generateEvidence(
  events: readonly DataLayerEvent[],
  options: Partial<EvidenceOptions> = {}
): Promise<GeneratedEvidence> {
  const opts: EvidenceOptions = { ...DEFAULT_EVIDENCE_OPTIONS, ...options };

  return generatePDF(events, opts);
}

/**
 * Tokenize a JSON line for syntax highlighting
 */
function tokenizeLine(line: string): Array<{ text: string; color: string }> {
  const tokens: Array<{ text: string; color: string }> = [];

  // Regex patterns for JSON syntax
  const patterns: Array<{ regex: RegExp; color: string }> = [
    // Key (property name before colon)
    { regex: /^(\s*)("[\w$]+")(:\s*)/, color: COLORS.key },
    // String value
    { regex: /"(?:[^"\\]|\\.)*"/, color: COLORS.string },
    // Number
    { regex: /-?\d+\.?\d*(?:[eE][+-]?\d+)?/, color: COLORS.number },
    // Boolean
    { regex: /\b(true|false)\b/, color: COLORS.boolean },
    // Null
    { regex: /\bnull\b/, color: COLORS.null },
    // Brackets and braces
    { regex: /[{}[\]]/, color: COLORS.bracket },
  ];

  let remaining = line;

  while (remaining.length > 0) {
    let matched = false;

    // Check for key pattern first (special handling)
    const keyMatch = remaining.match(/^(\s*)("[\w$]+")(:\s*)/);
    if (keyMatch?.[0]) {
      const whitespace = keyMatch[1] ?? "";
      const key = keyMatch[2] ?? "";
      const colon = keyMatch[3] ?? "";

      if (whitespace) {
        tokens.push({ text: whitespace, color: COLORS.text });
      }
      if (key) {
        tokens.push({ text: key, color: COLORS.key });
      }
      if (colon) {
        tokens.push({ text: colon, color: COLORS.text });
      }
      remaining = remaining.slice(keyMatch[0].length);
      matched = true;
      continue;
    }

    // Check other patterns
    for (const { regex, color } of patterns.slice(1)) {
      const match = remaining.match(new RegExp(`^(${regex.source})`));
      if (match?.[0]) {
        tokens.push({ text: match[0], color });
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }

    // If no pattern matched, take one character as plain text
    if (!matched) {
      // Check for whitespace or punctuation
      const wsMatch = remaining.match(/^[\s,]+/);
      if (wsMatch?.[0]) {
        tokens.push({ text: wsMatch[0], color: COLORS.text });
        remaining = remaining.slice(wsMatch[0].length);
      } else {
        const char = remaining[0];
        if (char) {
          tokens.push({ text: char, color: COLORS.text });
        }
        remaining = remaining.slice(1);
      }
    }
  }

  return tokens;
}

/**
 * Generate PDF evidence using jsPDF
 */
function generatePDF(
  events: readonly DataLayerEvent[],
  options: EvidenceOptions
): GeneratedEvidence {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const { margin, lineHeight, fontSize, pageWidth, pageHeight } = PDF_CONFIG;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper to add new page if needed
  const checkPageBreak = (requiredSpace: number): void => {
    if (y + requiredSpace > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // === BRANDING HEADER ===
  // Logo background (blue rounded rect)
  doc.setFillColor(59, 130, 246); // #3B82F6
  doc.roundedRect(margin, y - 2, 8, 8, 1, 1, "F");

  // "S" letter
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("S", margin + 2.5, y + 4);

  // "Strata" text
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  doc.text("Strata", margin + 11, y + 4);

  // "dataLayer Inspector" subtitle
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(128, 128, 128);
  doc.text("dataLayer Inspector", margin + 28, y + 4);

  y += lineHeight * 2.5;

  // === SCENARIO TITLE ===
  doc.setFontSize(fontSize.title);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(options.scenarioName, margin, y);
  y += lineHeight * 2;

  // Metadata
  doc.setFontSize(fontSize.header);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);

  if (options.includeTimestamp) {
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
    y += lineHeight;
  }

  if (options.includeUrl && events.length > 0) {
    const firstEvent = events[0];
    if (firstEvent) {
      const url = firstEvent.url;
      const truncatedUrl = url.length > 70 ? `${url.slice(0, 70)}...` : url;
      doc.text(`URL: ${truncatedUrl}`, margin, y);
      y += lineHeight;
    }
  }

  if (options.includeContainers && events.length > 0) {
    const containers = [...new Set(events.flatMap((e) => e.containerIds))];
    if (containers.length > 0) {
      doc.text(`Containers: ${containers.join(", ")}`, margin, y);
      y += lineHeight;
    }
  }

  y += lineHeight;

  // Events summary
  doc.setTextColor(60, 60, 60);
  doc.text(
    `${events.length} event${events.length !== 1 ? "s" : ""} captured`,
    margin,
    y
  );
  y += lineHeight * 2;

  // Events
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event) continue;

    const eventName = event.eventName ?? "(no event name)";
    const time = new Date(event.timestamp).toLocaleTimeString();
    const isExpanded = shouldExpandEvent(event, options);

    // Calculate space needed for this event
    const jsonStr = isExpanded ? JSON.stringify(event.data, null, 2) : "";
    const jsonLines = jsonStr.split("\n");
    const triggerLine = getTriggerLine(event, options);
    const triggerSpace = triggerLine ? lineHeight : 0;
    const eventSpace =
      (isExpanded
        ? lineHeight * 2 + jsonLines.length * (fontSize.code * 0.4) + lineHeight
        : lineHeight * 2) + triggerSpace;

    checkPageBreak(eventSpace);

    // Get validation status for this event
    const validation = options.validations?.get(event.id);
    const validationStatus = validation?.status ?? "none";

    // Event header with background
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y - 3, contentWidth, lineHeight + 2, 1, 1, "F");

    doc.setFontSize(fontSize.body);
    doc.setFont("courier", "bold");
    doc.setTextColor(78, 201, 176); // Teal for event name
    const eventText = `${i + 1}. ${eventName}`;
    doc.text(eventText, margin + 2, y + 1);

    // Validation badge (if enabled and has validation)
    if (options.includeValidation && validationStatus !== "none") {
      const eventTextWidth = doc.getTextWidth(eventText);
      const badgeX = margin + 2 + eventTextWidth + 3;
      const badgeText = validationStatus === "pass" ? "PASS" : "FAIL";

      // Badge background
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      const badgeWidth = doc.getTextWidth(badgeText) + 3;

      if (validationStatus === "pass") {
        doc.setFillColor(74, 222, 128); // green-400
      } else {
        doc.setFillColor(248, 113, 113); // red-400
      }
      doc.roundedRect(badgeX, y - 2.5, badgeWidth, 4, 0.5, 0.5, "F");

      // Badge text
      doc.setTextColor(255, 255, 255);
      doc.text(badgeText, badgeX + 1.5, y + 0.5);

      // Reset font
      doc.setFontSize(fontSize.body);
    }

    doc.setFont("courier", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(time, pageWidth - margin - 25, y + 1);
    y += lineHeight + 2;

    // Trigger attribution line (optional)
    if (triggerLine) {
      doc.setFontSize(fontSize.code);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120, 120, 120);
      const truncatedTrigger =
        triggerLine.length > 110
          ? `${triggerLine.slice(0, 110)}...`
          : triggerLine;
      doc.text(truncatedTrigger, margin + 4, y);
      y += lineHeight;
    }

    if (isExpanded) {
      // Event data with syntax highlighting
      doc.setFontSize(fontSize.code);
      doc.setFont("courier", "normal");

      for (const line of jsonLines) {
        checkPageBreak(lineHeight);
        const truncatedLine =
          line.length > 100 ? `${line.slice(0, 100)}...` : line;
        renderPDFSyntaxLine(doc, truncatedLine, margin + 4, y);
        y += fontSize.code * 0.4;
      }
      y += lineHeight / 2;
    }

    y += lineHeight / 2;
  }

  // Generate blob
  const pdfBlob = doc.output("blob");

  return {
    blob: pdfBlob,
    filename: generateFilename(options.scenarioName, "pdf"),
    mimeType: "application/pdf",
  };
}

/**
 * Render a syntax-highlighted line in PDF
 */
function renderPDFSyntaxLine(
  doc: jsPDF,
  line: string,
  x: number,
  y: number
): void {
  const tokens = tokenizeLine(line);
  let currentX = x;

  for (const token of tokens) {
    // Convert hex color to RGB
    const rgb = hexToRgb(token.color);
    doc.setTextColor(rgb.r, rgb.g, rgb.b);
    doc.text(token.text, currentX, y);
    currentX += doc.getTextWidth(token.text);
  }
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result?.[1] && result[2] && result[3]) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }
  return { r: 128, g: 128, b: 128 }; // Default gray
}

/**
 * Generate filename for evidence export
 */
function generateFilename(scenarioName: string, extension: string): string {
  const sanitized = scenarioName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const timestamp = new Date().toISOString().slice(0, 10);
  const prefix = sanitized ? `${sanitized}-` : "";
  return `${prefix}evidence-${timestamp}.${extension}`;
}
