/**
 * CustomEventPicker component - event selection for custom evidence export
 *
 * Event names alone are often ambiguous (several page_views, repeated
 * add_to_carts), so each row can preview the exact JSON that will be
 * printed expanded in the evidence document.
 */

import type { DataLayerEvent } from "@shared/types";
import type { EventCategory } from "@shared/utils";
import { getEventCategory } from "@shared/utils";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronIcon } from "../common";

interface CustomEventPickerProps {
  events: readonly DataLayerEvent[];
  selectedIds: ReadonlySet<string>;
  onToggle: (eventId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

const CATEGORY_DOT: Record<EventCategory, string> = {
  gtm: "bg-event-gtm",
  ecommerce: "bg-event-ecommerce",
  engagement: "bg-event-engagement",
  error: "bg-event-error",
  custom: "bg-event-custom",
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function CustomEventPicker({
  events,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
}: CustomEventPickerProps) {
  // Only one preview open at a time to keep the list scannable
  const [previewId, setPreviewId] = useState<string | null>(null);

  function togglePreview(eventId: string): void {
    setPreviewId((current) => (current === eventId ? null : eventId));
  }

  return (
    <div className="space-y-2">
      {/* Summary + bulk actions */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {selectedIds.size} of {events.length} expanded
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs text-brand-primary hover:text-brand-primary/80"
          >
            Select all
          </button>
          <span className="text-gray-600">|</span>
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-brand-primary hover:text-brand-primary/80"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Event rows */}
      <div className="max-h-64 overflow-y-auto border border-panel-border rounded bg-panel-surface">
        {events.map((event) => {
          const isSelected = selectedIds.has(event.id);
          const isPreviewOpen = previewId === event.id;
          const category = getEventCategory(event.eventName);

          return (
            <div
              key={event.id}
              className="border-b border-panel-border/50 last:border-b-0"
            >
              {/* Row */}
              <div
                className={cn(
                  "flex items-center gap-2 px-2 py-1 text-xs",
                  isSelected ? "bg-brand-primary/10" : "hover:bg-panel-bg/50"
                )}
              >
                <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer text-gray-300">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(event.id)}
                    className="rounded border-panel-border bg-panel-bg flex-shrink-0"
                  />
                  <span className="text-gray-600 font-mono flex-shrink-0">
                    #{event.index}
                  </span>
                  <span
                    className={cn(
                      "w-1.5 h-1.5 rounded-full flex-shrink-0",
                      CATEGORY_DOT[category]
                    )}
                    title={category}
                  />
                  <span
                    className="font-mono truncate flex-1 min-w-0"
                    title={event.eventName ?? "(no event name)"}
                  >
                    {event.eventName ?? "(no event name)"}
                  </span>
                  <span className="text-gray-500 text-[10px] flex-shrink-0">
                    {formatTime(event.timestamp)}
                  </span>
                </label>

                {/* Preview toggle */}
                <button
                  type="button"
                  onClick={() => togglePreview(event.id)}
                  aria-expanded={isPreviewOpen}
                  title={isPreviewOpen ? "Hide payload" : "Preview payload"}
                  className={cn(
                    "w-5 h-5 flex items-center justify-center rounded flex-shrink-0",
                    "text-gray-500 hover:text-gray-200 hover:bg-panel-bg transition-colors"
                  )}
                >
                  <ChevronIcon
                    className={cn(
                      "w-3 h-3 transition-transform",
                      isPreviewOpen && "rotate-90"
                    )}
                  />
                </button>
              </div>

              {/* Payload preview: exactly what the evidence will print */}
              {isPreviewOpen && (
                <div className="px-2 pb-2">
                  <pre className="max-h-40 overflow-auto p-2 text-2xs font-mono text-gray-300 bg-panel-bg border border-panel-border rounded whitespace-pre">
                    {JSON.stringify(event.data, null, 2)}
                  </pre>
                  <p className="mt-1 text-[10px] text-gray-600">
                    This payload is printed in the document when the event is
                    expanded.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
