/**
 * Toolbar component - top bar with actions
 *
 * High-frequency actions (Record, Clear) stay as buttons; the three
 * export flavors live under a single Export menu to reduce noise.
 */

import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { useCommands, useExport, useSchemas } from "../../hooks";
import { MODAL_TYPE, RIGHT_PANEL_VIEW, usePanelStore } from "../../store";
import { selectConnectionInfo, selectEventCounts } from "../../store/selectors";
import {
  Button,
  ChevronIcon,
  ClearIcon,
  ConfirmDialog,
  EvidenceIcon,
  ExportIcon,
  SchemaIcon,
  SettingsIcon,
  TestIcon,
} from "../common";

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

  const isSchemaView =
    rightPanelView.type === RIGHT_PANEL_VIEW.SCHEMA_LIST ||
    rightPanelView.type === RIGHT_PANEL_VIEW.SCHEMA_EDITOR;

  function handleClearClick(): void {
    if (counts.total > 0) {
      setShowClearConfirm(true);
    }
  }

  function handleClearConfirm(): void {
    void clearEvents();
    setShowClearConfirm(false);
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 border-b border-panel-border bg-panel-surface">
      {/* Recording toggle */}
      <Button
        variant={isRecording ? "primary" : "ghost"}
        size="sm"
        onClick={() => void toggleRecording()}
        title={isRecording ? "Pause recording" : "Resume recording"}
      >
        <span
          className={cn(
            "w-2 h-2 rounded-full md:mr-1.5",
            isRecording ? "bg-red-500 animate-pulse" : "bg-gray-500"
          )}
        />
        <span className="hidden md:inline">
          {isRecording ? "Recording" : "Paused"}
        </span>
      </Button>

      {/* Clear button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClearClick}
        disabled={counts.total === 0}
        title="Clear events (Cmd+L)"
      >
        <ClearIcon className="w-4 h-4 md:mr-1" />
        <span className="hidden md:inline">Clear</span>
      </Button>

      {/* Export menu */}
      <ExportMenu
        disabled={!canExport}
        onExportJson={() => exportAll()}
        onExportTest={() => openModal(MODAL_TYPE.EXPORT_TEST)}
        onExportEvidence={() => openModal(MODAL_TYPE.EXPORT_EVIDENCE)}
      />

      {/* Schemas button */}
      <Button
        variant={isSchemaView ? "primary" : "ghost"}
        size="sm"
        onClick={showSchemaList}
        title="Validation schemas"
      >
        <SchemaIcon className="w-4 h-4 md:mr-1" />
        <span className="hidden md:inline">Schemas</span>
        {schemas.length > 0 && (
          <span className="ml-1 px-1 py-0.5 text-2xs bg-white/20 rounded">
            {schemas.length}
          </span>
        )}
      </Button>

      {/* Separator */}
      <div className="w-px h-4 bg-panel-border" />

      {/* Event count */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 flex-shrink-0">
        <span className="font-medium text-gray-200">{counts.total}</span>
        <span className="hidden sm:inline">events</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Container badges (collapsed beyond 2) */}
      <ContainerChips containers={containers} />

      {/* Settings */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => openModal(MODAL_TYPE.SETTINGS)}
        title="Settings"
      >
        <SettingsIcon className="w-4 h-4" />
      </Button>

      {/* Extension toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={settings.enabled}
        aria-label={settings.enabled ? "Disable extension" : "Enable extension"}
        onClick={() => void toggleEnabled()}
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
        title={
          isConnected
            ? "Connected"
            : isLoading
              ? "Connecting..."
              : "Disconnected"
        }
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

interface ExportMenuProps {
  disabled: boolean;
  onExportJson: () => void;
  onExportTest: () => void;
  onExportEvidence: () => void;
}

/**
 * Close a popover on outside click or Escape
 */
function useDismissable(
  isOpen: boolean,
  ref: React.RefObject<HTMLElement | null>,
  onDismiss: () => void
): void {
  useEffect(() => {
    if (!isOpen) return;

    function handleMouseDown(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    }

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        onDismiss();
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, ref, onDismiss]);
}

function ExportMenu({
  disabled,
  onExportJson,
  onExportTest,
  onExportEvidence,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useDismissable(isOpen, menuRef, () => setIsOpen(false));

  function pick(action: () => void): void {
    setIsOpen(false);
    action();
  }

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        title="Export events"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <ExportIcon className="w-4 h-4 md:mr-1" />
        <span className="hidden md:inline">Export</span>
        <ChevronIcon className="w-3 h-3 ml-1 rotate-90" />
      </Button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 z-20 min-w-44 py-1 bg-panel-bg border border-panel-border rounded shadow-lg"
        >
          <MenuItem
            icon={<ExportIcon className="w-4 h-4" />}
            label="JSON file"
            description="Raw events for debugging"
            onClick={() => pick(onExportJson)}
          />
          <MenuItem
            icon={<TestIcon className="w-4 h-4" />}
            label="Test code…"
            description="Playwright / Cypress"
            onClick={() => pick(onExportTest)}
          />
          <MenuItem
            icon={<EvidenceIcon className="w-4 h-4" />}
            label="Evidence…"
            description="PDF / PNG for QA reports"
            onClick={() => pick(onExportEvidence)}
          />
        </div>
      )}
    </div>
  );
}

/** How many container chips to show inline before collapsing to "+N" */
const MAX_VISIBLE_CONTAINERS = 2;

function ContainerChips({ containers }: { containers: readonly string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useDismissable(isOpen, popoverRef, () => setIsOpen(false));

  if (containers.length === 0) {
    return null;
  }

  const visible = containers.slice(0, MAX_VISIBLE_CONTAINERS);
  const hiddenCount = containers.length - visible.length;

  return (
    <div ref={popoverRef} className="relative flex items-center gap-1 min-w-0">
      {visible.map((container) => (
        <span
          key={container}
          className="px-1.5 py-0.5 text-2xs font-mono bg-event-gtm/20 text-event-gtm rounded truncate max-w-28"
          title={container}
        >
          {container}
        </span>
      ))}

      {hiddenCount > 0 && (
        <>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            title={`Show all ${containers.length} containers`}
            className={cn(
              "px-1.5 py-0.5 text-2xs font-mono rounded transition-colors",
              isOpen
                ? "bg-event-gtm/30 text-event-gtm"
                : "bg-panel-border text-gray-400 hover:text-gray-200"
            )}
          >
            +{hiddenCount}
          </button>

          {isOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 py-1.5 px-2 min-w-40 max-h-48 overflow-y-auto bg-panel-bg border border-panel-border rounded shadow-lg">
              <p className="text-2xs text-gray-500 mb-1">
                {containers.length} containers
              </p>
              <ul className="space-y-0.5">
                {containers.map((container) => (
                  <li
                    key={container}
                    className="text-2xs font-mono text-event-gtm whitespace-nowrap"
                  >
                    {container}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}

function MenuItem({ icon, label, description, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-panel-surface transition-colors"
    >
      <span className="text-gray-400">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-gray-200">{label}</span>
        <span className="block text-2xs text-gray-500">{description}</span>
      </span>
    </button>
  );
}
