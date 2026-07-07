/**
 * DetailView component - main detail panel showing selected event
 */

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useSelectedEvent } from "../../hooks";
import { usePanelStore, VIEW_MODE } from "../../store";
import { Button, RawIcon, SelectIcon, TableIcon, TreeIcon } from "../common";
import { JsonParamsView } from "./JsonParamsView";
import { JsonRawView } from "./JsonRawView";
import { JsonTreeView } from "./JsonTreeView";

/**
 * Collect tree paths to expand down to a given depth
 */
function collectExpandedPaths(
  value: unknown,
  path: string,
  remainingDepth: number,
  out: Set<string>
): void {
  if (remainingDepth <= 0) return;
  if (value === null || typeof value !== "object") return;

  const entries = Array.isArray(value)
    ? value.map((v, i) => [i, v] as const)
    : Object.entries(value);
  if (entries.length === 0) return;

  out.add(path);
  for (const [key, child] of entries) {
    collectExpandedPaths(child, `${path}.${key}`, remainingDepth - 1, out);
  }
}

export function DetailView() {
  const selectedEvent = useSelectedEvent();
  const viewMode = usePanelStore((s) => s.viewMode);
  const setViewMode = usePanelStore((s) => s.setViewMode);
  const defaultExpandDepth = usePanelStore(
    (s) => s.settings.defaultExpandDepth
  );
  const setExpandedPaths = usePanelStore((s) => s.setExpandedPaths);

  // Pre-expand the tree to the configured depth whenever selection changes
  useEffect(() => {
    if (!selectedEvent) return;

    const paths = new Set<string>();
    for (const [key, value] of Object.entries(selectedEvent.data)) {
      collectExpandedPaths(value, `root.${key}`, defaultExpandDepth, paths);
    }
    setExpandedPaths(paths);
  }, [selectedEvent, defaultExpandDepth, setExpandedPaths]);

  if (!selectedEvent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 px-4">
        <SelectIcon className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm font-medium text-gray-400">No event selected</p>
        <p className="text-xs mt-1 text-center leading-relaxed">
          Click an event in the list to inspect its payload.
          <br />
          Use{" "}
          <kbd className="text-2xs bg-panel-surface px-1.5 py-0.5 rounded border border-panel-border">
            ↑
          </kbd>{" "}
          <kbd className="text-2xs bg-panel-surface px-1.5 py-0.5 rounded border border-panel-border">
            ↓
          </kbd>{" "}
          keys to navigate.
        </p>
        <p className="mt-4 text-2xs text-gray-600">
          Right-click an event to create a validation schema
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-panel-border bg-panel-surface">
        <div className="flex-1 min-w-0 px-2">
          <span
            className={cn(
              "text-sm font-medium truncate",
              selectedEvent.eventName ? "text-gray-200" : "text-gray-500 italic"
            )}
          >
            {selectedEvent.eventName ?? "(push)"}
          </span>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 ml-2">
          <Button
            size="sm"
            variant={viewMode === VIEW_MODE.TREE ? "primary" : "ghost"}
            onClick={() => setViewMode(VIEW_MODE.TREE)}
            title="Tree view"
          >
            <TreeIcon className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === VIEW_MODE.PARAMS ? "primary" : "ghost"}
            onClick={() => setViewMode(VIEW_MODE.PARAMS)}
            title="Parameter table (GA4-friendly)"
          >
            <TableIcon className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === VIEW_MODE.RAW ? "primary" : "ghost"}
            onClick={() => setViewMode(VIEW_MODE.RAW)}
            title="Raw JSON"
          >
            <RawIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Event metadata */}
      <div className="flex items-center gap-3 px-2 py-1 text-2xs text-gray-400 border-b border-panel-border">
        <span>
          <strong className="text-gray-300">Event:</strong>{" "}
          {selectedEvent.eventName ?? "(none)"}
        </span>
        <span>
          <strong className="text-gray-300">Index:</strong> #
          {selectedEvent.index}
        </span>
        <span>
          <strong className="text-gray-300">Source:</strong>{" "}
          {selectedEvent.source}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === VIEW_MODE.TREE && (
          <JsonTreeView data={selectedEvent.data} />
        )}
        {viewMode === VIEW_MODE.PARAMS && (
          <JsonParamsView data={selectedEvent.data} />
        )}
        {viewMode === VIEW_MODE.RAW && (
          <JsonRawView data={selectedEvent.data} />
        )}
      </div>
    </div>
  );
}
