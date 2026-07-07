/**
 * StatusBar component - bottom status bar
 *
 * Shows connection status, event counts, validation summary and keyboard hints
 * Recording status is shown in Toolbar to avoid duplication
 */

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { usePanelStore } from "../../store";
import {
  selectConnectionInfo,
  selectEventCounts,
  selectValidationSummary,
  VALIDATION_FAILED_FILTER,
} from "../../store/selectors";

export function StatusBar() {
  const { containers, errorMessage } = usePanelStore(
    useShallow((s) => ({
      containers: s.containers,
      errorMessage: s.errorMessage,
    }))
  );

  const counts = usePanelStore(useShallow(selectEventCounts));
  const validation = usePanelStore(useShallow(selectValidationSummary));
  const { isConnected, isLoading, hasError } = usePanelStore(
    useShallow(selectConnectionInfo)
  );
  const activeFilter = usePanelStore((s) => s.activeFilter);
  const setActiveFilter = usePanelStore((s) => s.setActiveFilter);

  const [showLegend, setShowLegend] = useState(false);

  const failedFilterActive = activeFilter === VALIDATION_FAILED_FILTER;

  function toggleFailedFilter(): void {
    setActiveFilter(failedFilterActive ? null : VALIDATION_FAILED_FILTER);
  }

  return (
    <div className="flex items-center px-2 py-1 text-2xs text-gray-400 bg-panel-surface border-t border-panel-border">
      {/* Left section: Connection + Stats */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              isLoading && "bg-yellow-500",
              isConnected && "bg-green-500",
              hasError && "bg-red-500"
            )}
          />
          <span>
            {isLoading
              ? "Connecting"
              : isConnected
                ? "Connected"
                : "Disconnected"}
          </span>
        </div>

        {/* Event stats - grouped with color coding */}
        <div className="relative flex items-center gap-2">
          <span className="text-gray-300 font-medium">{counts.total}</span>
          <span>events</span>
          {counts.total > 0 && (
            <button
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              className="text-gray-500 hover:text-gray-300 transition-colors cursor-help"
              aria-label="Show color legend"
              aria-expanded={showLegend}
            >
              (<span className="text-event-gtm">{counts.gtm}</span>
              {" / "}
              <span className="text-event-ecommerce">{counts.ecommerce}</span>
              {" / "}
              <span className="text-event-engagement">{counts.engagement}</span>
              {" / "}
              <span className="text-event-custom">{counts.custom}</span>
              {counts.error > 0 && (
                <>
                  {" / "}
                  <span className="text-event-error">{counts.error}</span>
                </>
              )}
              )
            </button>
          )}

          {/* Color legend popup */}
          {showLegend && (
            <div className="absolute bottom-full left-0 mb-1 p-2 bg-panel-bg border border-panel-border rounded shadow-lg z-10">
              <p className="text-gray-300 font-medium mb-1.5">
                Event Categories
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-event-gtm" />
                  <span className="text-event-gtm">GTM</span>
                  <span className="text-gray-500">— gtm.*, js, config</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-event-ecommerce" />
                  <span className="text-event-ecommerce">Ecommerce</span>
                  <span className="text-gray-500">
                    — purchase, view_item, etc.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-event-engagement" />
                  <span className="text-event-engagement">Engagement</span>
                  <span className="text-gray-500">
                    — page_view, login, search, etc.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-event-custom" />
                  <span className="text-event-custom">Custom</span>
                  <span className="text-gray-500">— your custom events</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-event-error" />
                  <span className="text-event-error">Error</span>
                  <span className="text-gray-500">— contains "error"</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Validation summary (only when schemas are active) */}
        {validation.hasSchemas && (
          <button
            type="button"
            onClick={toggleFailedFilter}
            title={
              failedFilterActive
                ? "Show all events"
                : "Show only events that failed validation"
            }
            className={cn(
              "flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-colors",
              failedFilterActive
                ? "bg-event-error/20 ring-1 ring-event-error/50"
                : "hover:bg-panel-bg"
            )}
          >
            <span className="text-valid">✓ {validation.passed}</span>
            <span
              className={cn(
                validation.failed > 0 ? "text-event-error" : "text-gray-500"
              )}
            >
              ✗ {validation.failed}
            </span>
          </button>
        )}

        {/* Container count */}
        {containers.length > 0 && (
          <span>
            {containers.length} container{containers.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section: Error + Hints */}
      <div className="flex items-center gap-4">
        {/* Error message */}
        {errorMessage && (
          <span className="text-event-error">{errorMessage}</span>
        )}

        {/* Keyboard shortcut hint */}
        <span className="hidden sm:inline text-gray-500">
          <kbd className="px-1 py-0.5 bg-panel-bg rounded text-gray-400">/</kbd>
          <span className="ml-1">search</span>
        </span>
      </div>
    </div>
  );
}
