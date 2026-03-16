/**
 * Toolbar component - top bar with actions
 */

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePanelStore, RIGHT_PANEL_VIEW, MODAL_TYPE } from "../../store";
import { selectEventCounts, selectConnectionInfo } from "../../store/selectors";
import { useCommands, useExport, useSchemas } from "../../hooks";
import { 
  Button, 
  ConfirmDialog,
  ClearIcon,
  ExportIcon,
  SchemaIcon,
  TestIcon,
  EvidenceIcon,
} from "../common";
import { cn } from "@/lib/utils";

export function Toolbar() {
  const { isRecording, containers, rightPanelView, settings } = usePanelStore(
    useShallow((s) => ({
      isRecording: s.isRecording,
      containers: s.containers,
      rightPanelView: s.rightPanelView,
      settings: s.settings,
    }))
  );

  const counts = usePanelStore(useShallow(selectEventCounts));
  const { isConnected, isLoading } = usePanelStore(
    useShallow(selectConnectionInfo)
  );
  const { clearEvents, toggleRecording, toggleEnabled } = useCommands();
  const { exportAll, canExport } = useExport();
  const { schemas } = useSchemas();
  const showSchemaList = usePanelStore((s) => s.showSchemaList);
  const openModal = usePanelStore((s) => s.openModal);

  // Confirm dialog state for clear
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const isSchemaView = rightPanelView.type === RIGHT_PANEL_VIEW.SCHEMA_LIST ||
    rightPanelView.type === RIGHT_PANEL_VIEW.SCHEMA_EDITOR;

  function handleClearClick(): void {
    if (counts.total > 0) {
      setShowClearConfirm(true);
    }
  }

  function handleClearConfirm(): void {
    clearEvents();
    setShowClearConfirm(false);
  }

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
        onClick={handleClearClick}
        disabled={counts.total === 0}
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

      {/* Export Test button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openModal(MODAL_TYPE.EXPORT_TEST)}
        disabled={!canExport}
        title="Export as test code (Cmd+Shift+T)"
      >
        <TestIcon className="w-4 h-4 mr-1" />
        Test
      </Button>

      {/* Export Evidence button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openModal(MODAL_TYPE.EXPORT_EVIDENCE)}
        disabled={!canExport}
        title="Export as evidence (PNG/PDF)"
      >
        <EvidenceIcon className="w-4 h-4 mr-1" />
        Evidence
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

      {/* Extension toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={settings.enabled}
        aria-label={settings.enabled ? "Disable extension" : "Enable extension"}
        onClick={toggleEnabled}
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
          settings.enabled ? "bg-brand-primary" : "bg-gray-600"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform",
            settings.enabled ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>

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

      {/* Clear confirmation dialog */}
      <ConfirmDialog
        isOpen={showClearConfirm}
        title="Clear All Events"
        message={`Are you sure you want to clear all ${counts.total} events? This action cannot be undone.`}
        confirmText="Clear"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleClearConfirm}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
