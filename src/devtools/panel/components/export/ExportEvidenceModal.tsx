/**
 * ExportEvidenceModal component - Generate PDF evidence from events
 */

import { generateEvidence } from "@shared/generators";
import type { DataLayerEvent, EventViewMode } from "@shared/types";
import { DEFAULT_EVIDENCE_OPTIONS, EVENT_VIEW_MODE } from "@shared/types";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "../../hooks";
import { usePanelStore } from "../../store";
import {
  Button,
  CloseIcon,
  DownloadIcon,
  EvidenceIcon,
  SpinnerIcon,
} from "../common";
import { CustomEventPicker } from "./CustomEventPicker";

interface ExportEvidenceModalProps {
  events: readonly DataLayerEvent[];
  onClose: () => void;
}

export function ExportEvidenceModal({
  events,
  onClose,
}: ExportEvidenceModalProps) {
  // Get validations from store
  const validations = usePanelStore((s) => s.validations);
  const schemas = usePanelStore((s) => s.schemas);
  const hasSchemas = schemas.length > 0;

  const [scenarioName, setScenarioName] = useState(
    DEFAULT_EVIDENCE_OPTIONS.scenarioName
  );
  const [eventViewMode, setEventViewMode] = useState<EventViewMode>(
    DEFAULT_EVIDENCE_OPTIONS.eventViewMode
  );
  const [customExpandedEvents, setCustomExpandedEvents] = useState<Set<string>>(
    () => new Set()
  );
  const [includeTimestamp, setIncludeTimestamp] = useState(
    DEFAULT_EVIDENCE_OPTIONS.includeTimestamp
  );
  const [includeUrl, setIncludeUrl] = useState(
    DEFAULT_EVIDENCE_OPTIONS.includeUrl
  );
  const [includeContainers, setIncludeContainers] = useState(
    DEFAULT_EVIDENCE_OPTIONS.includeContainers
  );
  const [includeValidation, setIncludeValidation] = useState(
    DEFAULT_EVIDENCE_OPTIONS.includeValidation
  );
  const [includeTrigger, setIncludeTrigger] = useState(
    DEFAULT_EVIDENCE_OPTIONS.includeTrigger
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Focus trap
  const containerRef = useFocusTrap<HTMLDivElement>({
    isActive: true,
    onEscape: onClose,
  });

  // Toggle a single event in custom selection
  function toggleCustomEvent(eventId: string): void {
    setCustomExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }

  // Select/deselect all events for custom mode
  function selectAllEvents(): void {
    setCustomExpandedEvents(new Set(events.map((e) => e.id)));
  }

  function deselectAllEvents(): void {
    setCustomExpandedEvents(new Set());
  }

  // Count of expanded events for preview
  const expandedCount = useMemo(() => {
    switch (eventViewMode) {
      case EVENT_VIEW_MODE.EXPANDED:
        return events.length;
      case EVENT_VIEW_MODE.COLLAPSED:
        return 0;
      case EVENT_VIEW_MODE.CUSTOM:
        return customExpandedEvents.size;
    }
  }, [eventViewMode, events.length, customExpandedEvents.size]);

  async function handleGenerate(): Promise<void> {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const shouldIncludeValidation = includeValidation && hasSchemas;
      const options = {
        scenarioName,
        eventViewMode,
        ...(eventViewMode === EVENT_VIEW_MODE.CUSTOM && {
          customExpandedEvents,
        }),
        includeTimestamp,
        includeUrl,
        includeContainers,
        includeValidation: shouldIncludeValidation,
        includeTrigger,
        ...(shouldIncludeValidation && { validations }),
      };
      const evidence = await generateEvidence(events, options);

      // Download the file
      const url = URL.createObjectURL(evidence.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = evidence.filename;
      a.click();
      URL.revokeObjectURL(url);

      onClose();
    } catch (error) {
      console.error("Failed to generate evidence:", error);
      setGenerateError(
        error instanceof Error
          ? error.message
          : "Failed to generate the evidence document."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  // Count validation stats
  const validationStats = hasSchemas
    ? Array.from(validations.values()).reduce(
        (acc, v) => {
          if (v.status === "pass") acc.pass++;
          else if (v.status === "fail") acc.fail++;
          return acc;
        },
        { pass: 0, fail: 0 }
      )
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-evidence-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal content */}
      <div
        ref={containerRef}
        className="relative bg-panel-bg border border-panel-border rounded-lg shadow-xl w-[500px] flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
          <div className="flex items-center gap-2">
            <EvidenceIcon className="w-5 h-5 text-brand-primary" />
            <h2
              id="export-evidence-modal-title"
              className="text-sm font-medium"
            >
              Export Evidence
            </h2>
            <span className="text-xs text-gray-500">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <CloseIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Options */}
        <div className="px-4 py-4 space-y-4 overflow-y-auto">
          {/* Scenario name */}
          <div className="flex items-center gap-4">
            <label
              htmlFor="evidence-scenario-name"
              className="text-xs font-medium text-gray-400 w-28"
            >
              Scenario name
            </label>
            <input
              id="evidence-scenario-name"
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="flex-1 px-2 py-1 text-sm rounded border border-panel-border bg-panel-surface text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          {/* View options */}
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-gray-400 w-28">
              Event view
            </span>
            <div className="flex gap-2">
              <ToggleButton
                active={eventViewMode === EVENT_VIEW_MODE.EXPANDED}
                onClick={() => setEventViewMode(EVENT_VIEW_MODE.EXPANDED)}
              >
                Expanded
              </ToggleButton>
              <ToggleButton
                active={eventViewMode === EVENT_VIEW_MODE.COLLAPSED}
                onClick={() => setEventViewMode(EVENT_VIEW_MODE.COLLAPSED)}
              >
                Collapsed
              </ToggleButton>
              <ToggleButton
                active={eventViewMode === EVENT_VIEW_MODE.CUSTOM}
                onClick={() => setEventViewMode(EVENT_VIEW_MODE.CUSTOM)}
              >
                Custom
              </ToggleButton>
            </div>
          </div>

          {/* Custom event selection */}
          {eventViewMode === EVENT_VIEW_MODE.CUSTOM && (
            <CustomEventPicker
              events={events}
              selectedIds={customExpandedEvents}
              onToggle={toggleCustomEvent}
              onSelectAll={selectAllEvents}
              onClear={deselectAllEvents}
            />
          )}

          {/* Include options */}
          <div className="space-y-2 pt-2 border-t border-panel-border">
            <span className="text-xs font-medium text-gray-400">Include</span>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeTimestamp}
                  onChange={(e) => setIncludeTimestamp(e.target.checked)}
                  className="rounded border-panel-border bg-panel-surface"
                />
                Timestamp
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUrl}
                  onChange={(e) => setIncludeUrl(e.target.checked)}
                  className="rounded border-panel-border bg-panel-surface"
                />
                URL
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeContainers}
                  onChange={(e) => setIncludeContainers(e.target.checked)}
                  className="rounded border-panel-border bg-panel-surface"
                />
                Containers
              </label>
              <label
                className={cn(
                  "flex items-center gap-2 text-xs cursor-pointer",
                  hasSchemas
                    ? "text-gray-400"
                    : "text-gray-600 cursor-not-allowed"
                )}
                title={
                  hasSchemas
                    ? "Include validation status badges"
                    : "No schemas loaded"
                }
              >
                <input
                  type="checkbox"
                  checked={includeValidation && hasSchemas}
                  onChange={(e) => setIncludeValidation(e.target.checked)}
                  disabled={!hasSchemas}
                  className="rounded border-panel-border bg-panel-surface disabled:opacity-50"
                />
                Validation status
              </label>
              <label
                className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer"
                title='Show what caused each event, e.g. Click on "Add to cart"'
              >
                <input
                  type="checkbox"
                  checked={includeTrigger}
                  onChange={(e) => setIncludeTrigger(e.target.checked)}
                  className="rounded border-panel-border bg-panel-surface"
                />
                Trigger attribution
              </label>
            </div>
          </div>
        </div>

        {/* Preview summary */}
        <div className="px-4 py-3 bg-panel-surface border-t border-panel-border">
          <div className="text-xs text-gray-400">
            <span className="font-medium text-gray-300">Preview: </span>
            {events.length} events will be exported as PDF
            {eventViewMode === EVENT_VIEW_MODE.EXPANDED &&
              " with full event data"}
            {eventViewMode === EVENT_VIEW_MODE.COLLAPSED && " in summary view"}
            {eventViewMode === EVENT_VIEW_MODE.CUSTOM &&
              ` (${expandedCount} expanded)`}
            {includeValidation && validationStats && (
              <span className="ml-2">
                (
                <span className="text-green-400">
                  {validationStats.pass} pass
                </span>
                {validationStats.fail > 0 && (
                  <span className="text-red-400">
                    , {validationStats.fail} fail
                  </span>
                )}
                )
              </span>
            )}
          </div>
        </div>

        {/* Generation error */}
        {generateError && (
          <div className="px-4 py-2 text-xs text-event-error bg-event-error/10 border-t border-event-error/30">
            {generateError}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-panel-border">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void handleGenerate()}
            disabled={isGenerating || events.length === 0}
          >
            {isGenerating ? (
              <>
                <SpinnerIcon className="w-4 h-4 mr-1 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <DownloadIcon className="w-4 h-4 mr-1" />
                Generate PDF
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 text-xs font-medium rounded transition-colors",
        active
          ? "bg-brand-primary text-white"
          : "bg-panel-surface text-gray-400 hover:text-gray-200"
      )}
    >
      {children}
    </button>
  );
}
