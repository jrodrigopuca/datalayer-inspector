/**
 * StatusBar component - bottom status bar
 * 
 * Shows connection status, event counts, and keyboard hints
 * Recording status is shown in Toolbar to avoid duplication
 */

import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePanelStore } from "../../store";
import { selectConnectionInfo, selectEventCounts } from "../../store/selectors";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const { containers, errorMessage } = usePanelStore(
    useShallow((s) => ({
      containers: s.containers,
      errorMessage: s.errorMessage,
    }))
  );

  const counts = usePanelStore(useShallow(selectEventCounts));
  const { isConnected, isLoading, hasError } = usePanelStore(
    useShallow(selectConnectionInfo)
  );

  const [showLegend, setShowLegend] = useState(false);

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
              <span className="text-event-custom">{counts.custom}</span>)
            </button>
          )}
          
          {/* Color legend popup */}
          {showLegend && (
            <div className="absolute bottom-full left-0 mb-1 p-2 bg-panel-bg border border-panel-border rounded shadow-lg z-10">
              <p className="text-gray-300 font-medium mb-1.5">Event Categories</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-event-gtm" />
                  <span className="text-event-gtm">GTM</span>
                  <span className="text-gray-500">— gtm.*, js, config</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-event-ecommerce" />
                  <span className="text-event-ecommerce">Ecommerce</span>
                  <span className="text-gray-500">— purchase, view_item, etc.</span>
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

        {/* Container count */}
        {containers.length > 0 && (
          <span>{containers.length} container{containers.length !== 1 ? "s" : ""}</span>
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
        <span className="text-gray-500">
          <kbd className="px-1 py-0.5 bg-panel-bg rounded text-gray-400">/</kbd>
          <span className="ml-1">search</span>
        </span>
      </div>
    </div>
  );
}
