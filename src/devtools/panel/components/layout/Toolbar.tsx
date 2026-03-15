/**
 * Toolbar component - top bar with actions
 */

import { useShallow } from "zustand/react/shallow";
import { usePanelStore, RIGHT_PANEL_VIEW } from "../../store";
import { selectEventCounts, selectConnectionInfo } from "../../store/selectors";
import { useCommands, useExport, useSchemas } from "../../hooks";
import { Button } from "../common";
import { cn } from "@/lib/utils";

export function Toolbar() {
  const { isRecording, containers, rightPanelView } = usePanelStore(
    useShallow((s) => ({
      isRecording: s.isRecording,
      containers: s.containers,
      rightPanelView: s.rightPanelView,
    }))
  );

  const counts = usePanelStore(useShallow(selectEventCounts));
  const { isConnected, isLoading } = usePanelStore(
    useShallow(selectConnectionInfo)
  );
  const { clearEvents, toggleRecording } = useCommands();
  const { exportAll, canExport } = useExport();
  const { schemas } = useSchemas();
  const showSchemaList = usePanelStore((s) => s.showSchemaList);

  const isSchemaView = rightPanelView.type === RIGHT_PANEL_VIEW.SCHEMA_LIST ||
    rightPanelView.type === RIGHT_PANEL_VIEW.SCHEMA_EDITOR;

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-panel-border bg-panel-surface">
      {/* Recording toggle */}
      <Button
        variant={isRecording ? "primary" : "ghost"}
        size="sm"
        onClick={toggleRecording}
        title={isRecording ? "Pause recording" : "Resume recording"}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full mr-1.5",
            isRecording ? "bg-red-500 animate-pulse" : "bg-gray-500"
          )}
        />
        {isRecording ? "Recording" : "Paused"}
      </Button>

      {/* Clear button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={clearEvents}
        title="Clear events (Cmd+L)"
      >
        <ClearIcon className="w-4 h-4 mr-1" />
        Clear
      </Button>

      {/* Export JSON button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => exportAll()}
        disabled={!canExport}
        title="Export as JSON (Cmd+Shift+E)"
      >
        <ExportIcon className="w-4 h-4 mr-1" />
        Export
      </Button>

      {/* Schemas button */}
      <Button
        variant={isSchemaView ? "primary" : "ghost"}
        size="sm"
        onClick={showSchemaList}
        title="Validation schemas"
      >
        <SchemaIcon className="w-4 h-4 mr-1" />
        Schemas
        {schemas.length > 0 && (
          <span className="ml-1 px-1 py-0.5 text-2xs bg-white/20 rounded">
            {schemas.length}
          </span>
        )}
      </Button>

      {/* Separator */}
      <div className="w-px h-4 bg-panel-border" />

      {/* Event count */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <span className="font-medium text-gray-200">{counts.total}</span>
        <span>events</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Container badges */}
      {containers.length > 0 && (
        <div className="flex items-center gap-1">
          {containers.map((container) => (
            <span
              key={container}
              className="px-1.5 py-0.5 text-2xs font-mono bg-event-gtm/20 text-event-gtm rounded"
            >
              {container}
            </span>
          ))}
        </div>
      )}

      {/* Connection status */}
      <div
        className={cn(
          "w-2 h-2 rounded-full",
          isLoading && "bg-yellow-500 animate-pulse",
          isConnected && "bg-green-500",
          !isConnected && !isLoading && "bg-red-500"
        )}
        title={isConnected ? "Connected" : isLoading ? "Connecting..." : "Disconnected"}
      />
    </div>
  );
}

function ClearIcon({ className }: { className?: string }) {
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
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function ExportIcon({ className }: { className?: string }) {
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
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}

function SchemaIcon({ className }: { className?: string }) {
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
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
