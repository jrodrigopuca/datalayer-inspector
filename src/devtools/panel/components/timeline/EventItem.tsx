/**
 * EventItem component - single event in the list
 */

import type { DataLayerEvent, EventValidation } from "@shared/types";
import { EventBadge, getEventCategory } from "./EventBadge";
import { usePanelStore } from "../../store";
import { cn } from "@/lib/utils";

interface EventItemProps {
  event: DataLayerEvent;
  isSelected: boolean;
  onClick: () => void;
  onCreateSchema: () => void;
  validation?: EventValidation | undefined;
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
 * Get border color class based on event category
 */
function getBorderColor(eventName: string | null): string {
  const category = getEventCategory(eventName);

  switch (category) {
    case "gtm":
      return "border-l-event-gtm";
    case "ecommerce":
      return "border-l-event-ecommerce";
    case "error":
      return "border-l-event-error";
    default:
      return "border-l-event-custom";
  }
}

export function EventItem({ event, isSelected, onClick, onCreateSchema, validation }: EventItemProps) {
  const displayName = event.eventName ?? "(push)";
  const isGTMInternal = event.eventName?.startsWith("gtm.");

  function handleContextMenu(e: React.MouseEvent): void {
    e.preventDefault();
    onCreateSchema();
  }

  return (
    <div
      data-event-id={event.id}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "h-12 px-2 py-1.5 border-l-4 cursor-pointer transition-colors",
        getBorderColor(event.eventName),
        isSelected
          ? "bg-panel-surface ring-1 ring-brand-primary"
          : "hover:bg-panel-surface/50",
        isGTMInternal && "opacity-60"
      )}
    >
      {/* Row 1: Timestamp + badges */}
      <div className="flex items-center justify-between">
        <span className="text-2xs text-gray-500 font-mono">
          {formatTime(event.timestamp)}
        </span>
        <div className="flex items-center gap-1">
          {validation && (
            <ValidationBadge
              validation={validation}
              eventId={event.id}
            />
          )}
          {event.source !== "dataLayer" && (
            <span className="text-2xs text-gray-500 font-mono">
              {event.source}
            </span>
          )}
          <EventBadge eventName={event.eventName} />
        </div>
      </div>

      {/* Row 2: Event name */}
      <div className="flex items-center justify-between mt-0.5">
        <span
          className={cn(
            "text-sm font-medium truncate",
            event.eventName ? "text-gray-200" : "text-gray-500 italic"
          )}
        >
          {displayName}
        </span>
        <span className="text-2xs text-gray-600">#{event.index}</span>
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

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex items-center justify-center w-4 h-4 rounded-full text-2xs font-bold cursor-pointer hover:ring-2 hover:ring-white/30",
        isPassed
          ? "bg-green-500/20 text-green-400"
          : "bg-red-500/20 text-red-400"
      )}
      title={
        isPassed
          ? `Passed ${validation.results.length} schema(s) - click for details`
          : `Failed: ${validation.results.filter((r) => r.status === "fail").length} error(s) - click for details`
      }
    >
      {isPassed ? (
        <CheckIcon className="w-2.5 h-2.5" />
      ) : (
        <XIcon className="w-2.5 h-2.5" />
      )}
    </button>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
