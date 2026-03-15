/**
 * StatusBar component - bottom status bar
 */

import { useShallow } from "zustand/react/shallow";
import { usePanelStore } from "../../store";
import { selectConnectionInfo, selectEventCounts } from "../../store/selectors";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const { isRecording, containers, errorMessage } = usePanelStore(
    useShallow((s) => ({
      isRecording: s.isRecording,
      containers: s.containers,
      errorMessage: s.errorMessage,
    }))
  );

  const counts = usePanelStore(useShallow(selectEventCounts));
  const { isConnected, isLoading, hasError } = usePanelStore(
    useShallow(selectConnectionInfo)
  );

  return (
    <div className="flex items-center gap-3 px-2 py-1 text-2xs text-gray-400 bg-panel-surface border-t border-panel-border">
      {/* Connection status */}
      <div className="flex items-center gap-1">
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

      {/* Separator */}
      <span className="text-panel-border">|</span>

      {/* Recording status */}
      <span>{isRecording ? "Recording" : "Paused"}</span>

      {/* Separator */}
      <span className="text-panel-border">|</span>

      {/* Event stats */}
      <span>
        {counts.total} events ({counts.gtm} GTM, {counts.ecommerce} ecommerce,{" "}
        {counts.custom} custom)
      </span>

      {/* Separator */}
      <span className="text-panel-border">|</span>

      {/* Container count */}
      <span>{containers.length} containers</span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Error message */}
      {errorMessage && (
        <span className="text-event-error">{errorMessage}</span>
      )}

      {/* Keyboard shortcut hint */}
      <span className="text-gray-500">Press / to search</span>
    </div>
  );
}
