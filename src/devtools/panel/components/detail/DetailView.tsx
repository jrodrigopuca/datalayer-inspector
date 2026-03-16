/**
 * DetailView component - main detail panel showing selected event
 */

import { useSelectedEvent } from "../../hooks";
import { usePanelStore, VIEW_MODE } from "../../store";
import { JsonTreeView } from "./JsonTreeView";
import { JsonRawView } from "./JsonRawView";
import { Breadcrumb } from "./Breadcrumb";
import { Button, SelectIcon, TreeIcon, RawIcon } from "../common";

export function DetailView() {
  const selectedEvent = useSelectedEvent();
  const viewMode = usePanelStore((s) => s.viewMode);
  const setViewMode = usePanelStore((s) => s.setViewMode);

  if (!selectedEvent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 px-4">
        <SelectIcon className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm font-medium text-gray-400">No event selected</p>
        <p className="text-xs mt-1 text-center leading-relaxed">
          Click an event in the list to inspect its payload.<br />
          Use <kbd className="text-2xs bg-panel-surface px-1.5 py-0.5 rounded border border-panel-border">↑</kbd> <kbd className="text-2xs bg-panel-surface px-1.5 py-0.5 rounded border border-panel-border">↓</kbd> keys to navigate.
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
        <div className="flex-1 min-w-0">
          <Breadcrumb path={[]} onNavigate={() => {}} />
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 ml-2">
          <Button
            size="sm"
            variant={viewMode === VIEW_MODE.TREE ? "primary" : "ghost"}
            onClick={() => setViewMode(VIEW_MODE.TREE)}
          >
            <TreeIcon className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === VIEW_MODE.RAW ? "primary" : "ghost"}
            onClick={() => setViewMode(VIEW_MODE.RAW)}
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
          <strong className="text-gray-300">Index:</strong> #{selectedEvent.index}
        </span>
        <span>
          <strong className="text-gray-300">Source:</strong> {selectedEvent.source}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === VIEW_MODE.TREE ? (
          <JsonTreeView data={selectedEvent.data} />
        ) : (
          <JsonRawView data={selectedEvent.data} />
        )}
      </div>
    </div>
  );
}
