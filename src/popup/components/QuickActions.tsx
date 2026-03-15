/**
 * QuickActions component - common actions
 */

interface QuickActionsProps {
  onClear: () => void;
  onToggleRecording: () => void;
  isRecording: boolean;
}

export function QuickActions({
  onClear,
  onToggleRecording,
  isRecording,
}: QuickActionsProps) {
  return (
    <div className="flex gap-2 p-3 border-t border-panel-border">
      <button
        onClick={onToggleRecording}
        className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
          isRecording
            ? "bg-event-error/20 text-event-error hover:bg-event-error/30"
            : "bg-event-gtm/20 text-event-gtm hover:bg-event-gtm/30"
        }`}
      >
        {isRecording ? "Pause" : "Record"}
      </button>
      <button
        onClick={onClear}
        className="flex-1 py-1.5 text-xs font-medium rounded bg-panel-surface text-gray-300 hover:bg-panel-border transition-colors"
      >
        Clear
      </button>
    </div>
  );
}
