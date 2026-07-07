/**
 * EventItem component - single event in the list
 */

import type { DataLayerEvent, EventValidation } from "@shared/types";
import {
  formatTriggerFull,
  formatTriggerShort,
  getEventCategory,
  isUserInteractionTrigger,
} from "@shared/utils";
import { cn } from "@/lib/utils";
import { usePanelStore } from "../../store";
import { CheckIcon, XIcon } from "../common";
import { EventBadge } from "./EventBadge";

interface EventItemProps {
  event: DataLayerEvent;
  isSelected: boolean;
  onClick: () => void;
  onCreateSchema: () => void;
  validation?: EventValidation | undefined;
  /** Milliseconds elapsed since the previous event in the full stream */
  deltaMs?: number | null;
}

/**
 * Format a time delta compactly: +82ms, +1.4s, +2m 05s
 */
function formatDelta(deltaMs: number): string {
  if (deltaMs < 1000) return `+${deltaMs}ms`;
  if (deltaMs < 60_000) return `+${(deltaMs / 1000).toFixed(1)}s`;
  const minutes = Math.floor(deltaMs / 60_000);
  const seconds = Math.round((deltaMs % 60_000) / 1000);
  return `+${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

/**
 * Format timestamp as HH:MM:SS.mmm
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  const ms = date.getMilliseconds().toString().padStart(3, "0");
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Get timezone abbreviation (e.g., "PST", "EST", "UTC+2")
 */
function getTimezoneAbbr(): string {
  const date = new Date();
  // Try to get timezone abbreviation from toLocaleTimeString
  const timeString = date.toLocaleTimeString("en-US", {
    timeZoneName: "short",
  });
  const match = timeString.match(/\s([A-Z]{2,5}|UTC[+-]\d+)$/);
  if (match?.[1]) {
    return match[1];
  }
  // Fallback: calculate UTC offset
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset / 60);
  const minutes = absOffset % 60;
  return minutes
    ? `UTC${sign}${hours}:${minutes.toString().padStart(2, "0")}`
    : `UTC${sign}${hours}`;
}

/**
 * Format full timestamp with date and timezone for tooltip
 */
function formatFullTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = formatTime(timestamp);
  return `${dateStr} ${timeStr} (${getTimezoneAbbr()})`;
}

/**
 * Get border color class based on event category
 */
function getBorderColor(eventName: string | null): string {
  const category = getEventCategory(eventName);

  switch (category) {
    case "gtm":
      return "border-l-event-gtm";
    case "ecommerce":
      return "border-l-event-ecommerce";
    case "engagement":
      return "border-l-event-engagement";
    case "error":
      return "border-l-event-error";
    default:
      return "border-l-event-custom";
  }
}

export function EventItem({
  event,
  isSelected,
  onClick,
  onCreateSchema,
  validation,
  deltaMs,
}: EventItemProps) {
  const displayName = event.eventName ?? "(push)";
  const isGTMInternal = event.eventName?.startsWith("gtm.");

  function handleContextMenu(e: React.MouseEvent): void {
    e.preventDefault();
    onCreateSchema();
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: row contains interactive badges; nesting them inside a real <button> would be invalid HTML
    <div
      data-event-id={event.id}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onContextMenu={handleContextMenu}
      className={cn(
        "h-12 px-2 py-1.5 border-l-4 cursor-pointer transition-colors overflow-hidden",
        getBorderColor(event.eventName),
        isSelected
          ? "bg-panel-surface ring-1 ring-brand-primary"
          : "hover:bg-panel-surface/50",
        isGTMInternal && "opacity-60"
      )}
    >
      {/* Row 1: Event name (primary) + validation/category */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <span
          className={cn(
            "flex-1 min-w-0 truncate text-sm font-medium",
            event.eventName ? "text-gray-200" : "text-gray-500 italic"
          )}
          title={displayName}
        >
          {displayName}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {validation && (
            <ValidationBadge validation={validation} eventId={event.id} />
          )}
          <EventBadge eventName={event.eventName} />
        </div>
      </div>

      {/* Row 2: Time metadata + trigger */}
      <div className="flex items-baseline gap-1.5 mt-0.5 min-w-0 text-2xs font-mono">
        <span
          className="text-gray-500 flex-shrink-0"
          title={formatFullTimestamp(event.timestamp)}
        >
          {formatTime(event.timestamp)}
        </span>
        {deltaMs !== null && deltaMs !== undefined && (
          <span
            className="text-gray-600 flex-shrink-0"
            title="Time since previous event"
          >
            {formatDelta(deltaMs)}
          </span>
        )}
        {event.source !== "dataLayer" && (
          <span
            className="text-gray-500 truncate max-w-24"
            title={`Source: ${event.source}`}
          >
            {event.source}
          </span>
        )}
        {event.trigger && isUserInteractionTrigger(event.trigger) && (
          <span
            className="ml-auto text-brand-primary/80 truncate min-w-0"
            title={`Triggered by ${formatTriggerFull(event.trigger)}`}
          >
            ⤷ {formatTriggerShort(event.trigger)}
          </span>
        )}
      </div>
    </div>
  );
}

function ValidationBadge({
  validation,
  eventId,
}: {
  validation: EventValidation;
  eventId: string;
}) {
  const showValidationErrors = usePanelStore((s) => s.showValidationErrors);

  if (validation.status === "none") {
    return null;
  }

  const isPassed = validation.status === "pass";

  function handleClick(e: React.MouseEvent): void {
    e.stopPropagation();
    showValidationErrors(eventId);
  }

  // Increase hit area for touch accessibility (44px minimum)
  // Visual badge is small but clickable area is larger
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={
        isPassed
          ? `Validation passed: ${validation.results.length} schema(s). Click for details`
          : `Validation failed: ${validation.results.filter((r) => r.status === "fail").length} error(s). Click for details`
      }
      className={cn(
        // Larger hit area with padding, visual badge centered inside
        "relative flex items-center justify-center w-6 h-6 -m-1 cursor-pointer",
        "hover:bg-white/10 rounded transition-colors"
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center w-4 h-4 rounded-full text-2xs font-bold",
          isPassed
            ? "bg-green-500/20 text-green-400"
            : "bg-red-500/20 text-red-400"
        )}
      >
        {isPassed ? (
          <CheckIcon className="w-2.5 h-2.5" />
        ) : (
          <XIcon className="w-2.5 h-2.5" />
        )}
      </span>
    </button>
  );
}
