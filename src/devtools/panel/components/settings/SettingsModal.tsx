/**
 * SettingsModal component - user-configurable extension settings
 *
 * Exposes the settings that previously existed only as types:
 * dataLayer names, preserve log, max events, tree expand depth, auto-scroll.
 */

import { DEFAULT_SETTINGS } from "@shared/types";
import { useState } from "react";
import { useCommands, useFocusTrap } from "../../hooks";
import { usePanelStore } from "../../store";
import { Button, CloseIcon, SettingsIcon, Toggle } from "../common";

interface SettingsModalProps {
  onClose: () => void;
}

/**
 * Parse comma-separated dataLayer names into a clean, deduped list
 */
function parseDataLayerNames(raw: string): string[] {
  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  return [...new Set(names)];
}

/**
 * Clamp a numeric input to a sane range, falling back when unparseable
 */
function clampNumber(
  raw: string,
  min: number,
  max: number,
  fallback: number
): number {
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const settings = usePanelStore((s) => s.settings);
  const { saveSettings } = useCommands();

  // Local draft state - applied on Save
  const [dataLayerNamesRaw, setDataLayerNamesRaw] = useState(
    settings.dataLayerNames.join(", ")
  );
  const [maxEventsRaw, setMaxEventsRaw] = useState(
    String(settings.maxEventsPerTab)
  );
  const [expandDepthRaw, setExpandDepthRaw] = useState(
    String(settings.defaultExpandDepth)
  );
  const [autoScroll, setAutoScroll] = useState(settings.autoScroll);
  const [preserveLog, setPreserveLog] = useState(settings.preserveLog);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useFocusTrap<HTMLDivElement>({
    isActive: true,
    onEscape: onClose,
  });

  const dataLayerNamesChanged =
    parseDataLayerNames(dataLayerNamesRaw).join(",") !==
    settings.dataLayerNames.join(",");

  async function handleSave(): Promise<void> {
    const dataLayerNames = parseDataLayerNames(dataLayerNamesRaw);
    if (dataLayerNames.length === 0) {
      setError("At least one dataLayer name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await saveSettings({
        dataLayerNames,
        maxEventsPerTab: clampNumber(
          maxEventsRaw,
          100,
          5000,
          DEFAULT_SETTINGS.maxEventsPerTab
        ),
        defaultExpandDepth: clampNumber(
          expandDepthRaw,
          0,
          10,
          DEFAULT_SETTINGS.defaultExpandDepth
        ),
        autoScroll,
        preserveLog,
      });
      onClose();
    } catch (saveError) {
      console.error("[Strata] Failed to save settings:", saveError);
      setError("Failed to save settings. Is the service worker running?");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal content */}
      <div
        ref={containerRef}
        className="relative bg-panel-bg border border-panel-border rounded-lg shadow-xl w-[480px] max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-brand-primary" />
            <h2 id="settings-modal-title" className="text-sm font-medium">
              Settings
            </h2>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <CloseIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Fields */}
        <div className="px-4 py-4 space-y-5 overflow-y-auto">
          {/* dataLayer names */}
          <div>
            <label
              htmlFor="settings-datalayer-names"
              className="block text-xs font-medium text-gray-300 mb-1"
            >
              DataLayer names
            </label>
            <input
              id="settings-datalayer-names"
              type="text"
              value={dataLayerNamesRaw}
              onChange={(e) => setDataLayerNamesRaw(e.target.value)}
              placeholder="dataLayer, customDataLayer"
              className="w-full px-2 py-1 text-sm font-mono rounded border border-panel-border bg-panel-surface text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <p className="text-2xs text-gray-500 mt-1">
              Comma-separated names of the arrays to monitor.
              {dataLayerNamesChanged && (
                <span className="text-warning">
                  {" "}
                  Reload the inspected page to apply.
                </span>
              )}
            </p>
          </div>

          {/* Preserve log */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="block text-xs font-medium text-gray-300">
                Preserve log
              </span>
              <p className="text-2xs text-gray-500 mt-0.5">
                Keep events when navigating to a different site (payment
                gateways, SSO redirects).
              </p>
            </div>
            <Toggle
              checked={preserveLog}
              onChange={() => setPreserveLog(!preserveLog)}
              label="Preserve log across cross-origin navigation"
            />
          </div>

          {/* Auto-scroll */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="block text-xs font-medium text-gray-300">
                Auto-scroll timeline
              </span>
              <p className="text-2xs text-gray-500 mt-0.5">
                Follow new events as they arrive.
              </p>
            </div>
            <Toggle
              checked={autoScroll}
              onChange={() => setAutoScroll(!autoScroll)}
              label="Auto-scroll to newest event"
            />
          </div>

          {/* Max events */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <label
                htmlFor="settings-max-events"
                className="block text-xs font-medium text-gray-300"
              >
                Max events per tab
              </label>
              <p className="text-2xs text-gray-500 mt-0.5">
                Oldest events are pruned beyond this limit (100–5000).
              </p>
            </div>
            <input
              id="settings-max-events"
              type="number"
              min={100}
              max={5000}
              step={100}
              value={maxEventsRaw}
              onChange={(e) => setMaxEventsRaw(e.target.value)}
              className="w-24 px-2 py-1 text-sm rounded border border-panel-border bg-panel-surface text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          {/* Default expand depth */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <label
                htmlFor="settings-expand-depth"
                className="block text-xs font-medium text-gray-300"
              >
                Tree expand depth
              </label>
              <p className="text-2xs text-gray-500 mt-0.5">
                Levels auto-expanded when selecting an event (0–10).
              </p>
            </div>
            <input
              id="settings-expand-depth"
              type="number"
              min={0}
              max={10}
              value={expandDepthRaw}
              onChange={(e) => setExpandDepthRaw(e.target.value)}
              className="w-24 px-2 py-1 text-sm rounded border border-panel-border bg-panel-surface text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          {/* Error */}
          {error && <p className="text-xs text-event-error">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-panel-border">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => void handleSave()}
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
