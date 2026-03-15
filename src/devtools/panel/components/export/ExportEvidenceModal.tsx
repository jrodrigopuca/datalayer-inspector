/**
 * ExportEvidenceModal component - Generate PNG/PDF evidence from events
 */

import { useState } from "react";
import { Button } from "../common";
import { usePanelStore } from "../../store";
import { generateEvidence } from "@shared/generators";
import { EVIDENCE_FORMAT, DEFAULT_EVIDENCE_OPTIONS } from "@shared/types";
import type { EvidenceFormat, DataLayerEvent } from "@shared/types";
import { cn } from "@/lib/utils";

interface ExportEvidenceModalProps {
  events: readonly DataLayerEvent[];
  onClose: () => void;
}

export function ExportEvidenceModal({ events, onClose }: ExportEvidenceModalProps) {
  // Get validations from store
  const validations = usePanelStore((s) => s.validations);
  const schemas = usePanelStore((s) => s.schemas);
  const hasSchemas = schemas.length > 0;

  const [format, setFormat] = useState<EvidenceFormat>(EVIDENCE_FORMAT.PDF);
  const [scenarioName, setScenarioName] = useState(DEFAULT_EVIDENCE_OPTIONS.scenarioName);
  const [expandedView, setExpandedView] = useState(DEFAULT_EVIDENCE_OPTIONS.expandedView);
  const [includeTimestamp, setIncludeTimestamp] = useState(DEFAULT_EVIDENCE_OPTIONS.includeTimestamp);
  const [includeUrl, setIncludeUrl] = useState(DEFAULT_EVIDENCE_OPTIONS.includeUrl);
  const [includeContainers, setIncludeContainers] = useState(DEFAULT_EVIDENCE_OPTIONS.includeContainers);
  const [includeValidation, setIncludeValidation] = useState(DEFAULT_EVIDENCE_OPTIONS.includeValidation);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate(): Promise<void> {
    setIsGenerating(true);
    try {
      const shouldIncludeValidation = includeValidation && hasSchemas;
      const options = {
        format,
        scenarioName,
        expandedView,
        includeTimestamp,
        includeUrl,
        includeContainers,
        includeValidation: shouldIncludeValidation,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-panel-bg border border-panel-border rounded-lg shadow-xl w-[500px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
          <div className="flex items-center gap-2">
            <EvidenceIcon className="w-5 h-5 text-brand-primary" />
            <h2 className="text-sm font-medium">Export Evidence</h2>
            <span className="text-xs text-gray-500">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <CloseIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Options */}
        <div className="px-4 py-4 space-y-4">
          {/* Format */}
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-gray-400 w-28">Format</label>
            <div className="flex gap-2">
              <ToggleButton
                active={format === EVIDENCE_FORMAT.PDF}
                onClick={() => setFormat(EVIDENCE_FORMAT.PDF)}
              >
                PDF
              </ToggleButton>
              <ToggleButton
                active={format === EVIDENCE_FORMAT.PNG}
                onClick={() => setFormat(EVIDENCE_FORMAT.PNG)}
              >
                PNG
              </ToggleButton>
            </div>
          </div>

          {/* Scenario name */}
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-gray-400 w-28">Scenario name</label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="flex-1 px-2 py-1 text-sm rounded border border-panel-border bg-panel-surface text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          {/* View options */}
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-gray-400 w-28">Event view</label>
            <div className="flex gap-2">
              <ToggleButton
                active={expandedView}
                onClick={() => setExpandedView(true)}
              >
                Expanded
              </ToggleButton>
              <ToggleButton
                active={!expandedView}
                onClick={() => setExpandedView(false)}
              >
                Collapsed
              </ToggleButton>
            </div>
          </div>

          {/* Include options */}
          <div className="space-y-2 pt-2 border-t border-panel-border">
            <label className="text-xs font-medium text-gray-400">Include in header</label>
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
                  hasSchemas ? "text-gray-400" : "text-gray-600 cursor-not-allowed"
                )}
                title={hasSchemas ? "Include validation status badges" : "No schemas loaded"}
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
            </div>
          </div>
        </div>

        {/* Preview summary */}
        <div className="px-4 py-3 bg-panel-surface border-t border-panel-border">
          <div className="text-xs text-gray-400">
            <span className="font-medium text-gray-300">Preview: </span>
            {events.length} events will be exported as {format.toUpperCase()}
            {expandedView ? " with full event data" : " in summary view"}
            {includeValidation && validationStats && (
              <span className="ml-2">
                (<span className="text-green-400">{validationStats.pass} pass</span>
                {validationStats.fail > 0 && (
                  <span className="text-red-400">, {validationStats.fail} fail</span>
                )})
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-panel-border">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleGenerate}
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
                Generate {format.toUpperCase()}
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

// Icons
function EvidenceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16 8 8 0 01-8-8z" />
    </svg>
  );
}
