/**
 * EventItem component - single event in the list
 */

import type { DataLayerEvent } from "@shared/types";
import { EventBadge, getEventCategory } from "./EventBadge";
import { cn } from "@/lib/utils";

interface EventItemProps {
  event: DataLayerEvent;
  isSelected: boolean;
  onClick: () => void;
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

export function EventItem({ event, isSelected, onClick }: EventItemProps) {
  const displayName = event.eventName ?? "(push)";
  const isGTMInternal = event.eventName?.startsWith("gtm.");

  return (
    <div
      onClick={onClick}
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
