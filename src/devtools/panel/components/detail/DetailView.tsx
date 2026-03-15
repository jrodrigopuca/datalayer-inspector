/**
 * DetailView component - main detail panel showing selected event
 */

import { useSelectedEvent } from "../../hooks";
import { usePanelStore, VIEW_MODE } from "../../store";
import { JsonTreeView } from "./JsonTreeView";
import { JsonRawView } from "./JsonRawView";
import { Breadcrumb } from "./Breadcrumb";
import { Button } from "../common";

export function DetailView() {
  const selectedEvent = useSelectedEvent();
  const viewMode = usePanelStore((s) => s.viewMode);
  const setViewMode = usePanelStore((s) => s.setViewMode);

  if (!selectedEvent) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <SelectIcon className="w-12 h-12 mb-2 opacity-50" />
        <p className="text-sm">Select an event to view details</p>
        <p className="text-xs mt-1">Use arrow keys or click to select</p>
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

function SelectIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
      />
    </svg>
  );
}

function TreeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M4 10h16M4 14h16M4 18h16"
      />
    </svg>
  );
}

function RawIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
      />
    </svg>
  );
}
