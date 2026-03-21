/**
 * Evidence generator - Creates PNG/PDF evidence from dataLayer events
 *
 * Uses Canvas API for PNG and jsPDF for PDF (no html2canvas dependency)
 */

import { jsPDF } from "jspdf";
import type { DataLayerEvent } from "../types/events";
import type { EvidenceOptions, GeneratedEvidence } from "../types/evidence";
import {
  EVIDENCE_FORMAT,
  EVENT_VIEW_MODE,
  DEFAULT_EVIDENCE_OPTIONS,
} from "../types/evidence";

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

/** Colors for the evidence document */
const COLORS = {
  background: "#1e1e1e",
  surface: "#252526",
  border: "#3c3c3c",
  text: "#cccccc",
  textMuted: "#808080",
  textBright: "#ffffff",
  accent: "#007acc",
  eventName: "#4ec9b0",
  timestamp: "#dcdcaa",
  // Syntax highlighting (VS Code dark theme inspired)
  key: "#9cdcfe",
  string: "#ce9178",
  number: "#b5cea8",
  boolean: "#569cd6",
  null: "#569cd6",
  bracket: "#ffd700",
  // Brand
  brand: "#3B82F6",
  // Validation status
  validPass: "#4ade80", // green-400
  validFail: "#f87171", // red-400
  validNone: "#a1a1aa", // zinc-400
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

  if (opts.format === EVIDENCE_FORMAT.PNG) {
    return generatePNG(events, opts);
  }
  return generatePDF(events, opts);
}

/**
 * Generate PNG evidence using Canvas API
 */
function generatePNG(
  events: readonly DataLayerEvent[],
  options: EvidenceOptions
): GeneratedEvidence {
  const padding = 20;
  const width = 800;
  const lineHeightPx = 14;
  const eventHeaderHeight = 30;
  const eventPadding = 15;
  const collapsedEventHeight = 40;
  const brandingHeight = 40;

  // Pre-calculate JSON lines for each event to determine total height
  const eventData = events.map((event) => {
    const jsonStr = JSON.stringify(event.data, null, 2);
    const lines = jsonStr.split("\n");
    const isExpanded = shouldExpandEvent(event, options);
    return {
      event,
      jsonLines: lines,
      isExpanded,
      height: isExpanded
        ? eventHeaderHeight + lines.length * lineHeightPx + eventPadding * 2
        : collapsedEventHeight,
    };
  });

  // Calculate total canvas height
  const headerHeight = 100; // Title + metadata
  const eventsHeaderHeight = 30;
  const totalEventsHeight = eventData.reduce(
    (sum, e) => sum + e.height + 10,
    0
  );
  const height =
    brandingHeight +
    headerHeight +
    eventsHeaderHeight +
    totalEventsHeight +
    padding * 2;

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = width * 2; // 2x for retina
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  // === BRANDING HEADER ===
  let y = padding;

  // Logo "S" in blue rounded square
  const logoSize = 24;
  ctx.fillStyle = COLORS.brand;
  roundRect(ctx, padding, y - 2, logoSize, logoSize, 4);
  ctx.fill();

  // "S" letter
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
  ctx.fillText("S", padding + 7, y + 16);

  // "Strata" text
  ctx.fillStyle = COLORS.textBright;
  ctx.font = "bold 14px system-ui, -apple-system, sans-serif";
  ctx.fillText("Strata", padding + logoSize + 8, y + 15);

  // "dataLayer Inspector" subtitle
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.fillText("dataLayer Inspector", padding + logoSize + 60, y + 15);

  y += brandingHeight;

  // === SCENARIO HEADER ===
  ctx.fillStyle = COLORS.textBright;
  ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
  ctx.fillText(options.scenarioName, padding, y + 18);
  y += 30;

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "12px system-ui, -apple-system, sans-serif";

  if (options.includeTimestamp) {
    ctx.fillText(`Generated: ${new Date().toLocaleString()}`, padding, y + 12);
    y += 18;
  }

  if (options.includeUrl && events.length > 0) {
    const firstEvent = events[0];
    if (firstEvent) {
      const url = firstEvent.url;
      const truncatedUrl = url.length > 80 ? url.slice(0, 80) + "..." : url;
      ctx.fillText(`URL: ${truncatedUrl}`, padding, y + 12);
      y += 18;
    }
  }

  if (options.includeContainers && events.length > 0) {
    const containers = [...new Set(events.flatMap((e) => e.containerIds))];
    if (containers.length > 0) {
      ctx.fillText(`Containers: ${containers.join(", ")}`, padding, y + 12);
      y += 18;
    }
  }

  y += 10;

  // Events header
  ctx.fillStyle = COLORS.textMuted;
  ctx.font = "bold 11px system-ui, -apple-system, sans-serif";
  ctx.fillText(
    `${events.length} event${events.length !== 1 ? "s" : ""} captured`,
    padding,
    y + 11
  );
  y += 25;

  // Render each event
  for (const {
    event,
    jsonLines,
    height: cardHeight,
    isExpanded,
  } of eventData) {
    // Get validation status for this event
    const validation = options.validations?.get(event.id);
    const validationStatus = validation?.status ?? "none";

    // Event card background
    ctx.fillStyle = COLORS.surface;
    roundRect(ctx, padding, y, width - padding * 2, cardHeight, 4);
    ctx.fill();

    // Event header
    ctx.fillStyle = COLORS.eventName;
    ctx.font = "bold 12px monospace";
    const eventLabel = event.eventName ?? "(no event name)";
    ctx.fillText(eventLabel, padding + 10, y + 18);

    // Validation badge (if enabled and has validation)
    if (options.includeValidation && validationStatus !== "none") {
      const badgeX = padding + 10 + ctx.measureText(eventLabel).width + 10;
      const badgeText = validationStatus === "pass" ? "✓ PASS" : "✗ FAIL";
      const badgeColor =
        validationStatus === "pass" ? COLORS.validPass : COLORS.validFail;

      // Badge background
      ctx.font = "bold 9px system-ui, -apple-system, sans-serif";
      const badgeWidth = ctx.measureText(badgeText).width + 10;
      ctx.fillStyle = badgeColor + "30"; // 30 = ~19% opacity in hex
      roundRect(ctx, badgeX, y + 6, badgeWidth, 14, 3);
      ctx.fill();

      // Badge text
      ctx.fillStyle = badgeColor;
      ctx.fillText(badgeText, badgeX + 5, y + 16);
    }

    // Timestamp
    ctx.fillStyle = COLORS.timestamp;
    ctx.font = "11px monospace";
    const time = new Date(event.timestamp).toLocaleTimeString();
    ctx.fillText(time, width - padding - 80, y + 18);

    if (isExpanded) {
      // Render JSON with syntax highlighting
      ctx.font = "10px monospace";
      let lineY = y + 35;
      for (const line of jsonLines) {
        renderSyntaxHighlightedLine(
          ctx,
          line,
          padding + 10,
          lineY,
          width - padding * 2 - 20
        );
        lineY += lineHeightPx;
      }
    }

    y += cardHeight + 10;
  }

  // Convert to blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve({
        blob: blob!,
        filename: generateFilename(options.scenarioName, "png"),
        mimeType: "image/png",
      });
    }, "image/png");
  }) as unknown as GeneratedEvidence;
}

/**
 * Render a JSON line with syntax highlighting on canvas
 */
function renderSyntaxHighlightedLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  maxWidth: number
): void {
  // Truncate if too long
  const truncatedLine = line.length > 95 ? line.slice(0, 95) + "..." : line;

  // Parse and colorize JSON tokens
  const tokens = tokenizeLine(truncatedLine);
  let currentX = x;

  for (const token of tokens) {
    ctx.fillStyle = token.color;
    ctx.fillText(token.text, currentX, y);
    currentX += ctx.measureText(token.text).width;

    if (currentX > x + maxWidth) break;
  }
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
    { regex: /[{}\[\]]/, color: COLORS.bracket },
  ];

  let remaining = line;

  while (remaining.length > 0) {
    let matched = false;

    // Check for key pattern first (special handling)
    const keyMatch = remaining.match(/^(\s*)("[\w$]+")(:\s*)/);
    if (keyMatch && keyMatch[0]) {
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
      if (match && match[0]) {
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
      if (wsMatch && wsMatch[0]) {
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
      const truncatedUrl = url.length > 70 ? url.slice(0, 70) + "..." : url;
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
    const eventSpace = isExpanded
      ? lineHeight * 2 + jsonLines.length * (fontSize.code * 0.4) + lineHeight
      : lineHeight * 2;

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

    if (isExpanded) {
      // Event data with syntax highlighting
      doc.setFontSize(fontSize.code);
      doc.setFont("courier", "normal");

      for (const line of jsonLines) {
        checkPageBreak(lineHeight);
        const truncatedLine =
          line.length > 100 ? line.slice(0, 100) + "..." : line;
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
  if (result && result[1] && result[2] && result[3]) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }
  return { r: 128, g: 128, b: 128 }; // Default gray
}

/**
 * Draw rounded rectangle on canvas
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
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
