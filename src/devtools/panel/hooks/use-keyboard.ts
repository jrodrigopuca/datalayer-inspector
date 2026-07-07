/**
 * useKeyboard hook - keyboard shortcuts for the panel
 */

import { useEffect } from "react";
import { usePanelStore } from "../store";
import { useCommands } from "./use-connection";
import { useEventSelection } from "./use-events";
import { useExport } from "./use-export";

/**
 * Register global keyboard shortcuts
 */
export function useKeyboard(): void {
  const { selectNext, selectPrevious, selectEvent } = useEventSelection();
  const { clearEvents, toggleRecording } = useCommands();
  const { exportAll, canExport } = useExport();
  const setSearchQuery = usePanelStore((s) => s.setSearchQuery);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      // Don't capture if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        // Allow Escape to blur input
        if (event.key === "Escape") {
          (event.target as HTMLElement).blur();
        }
        return;
      }

      // Handle Cmd/Ctrl shortcuts first (before navigation)
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case "k":
            event.preventDefault();
            // Focus search
            document
              .querySelector<HTMLInputElement>("[data-search-input]")
              ?.focus();
            return;

          case "l":
            event.preventDefault();
            void clearEvents();
            return;

          case "r":
            event.preventDefault();
            void toggleRecording();
            return;

          case "e":
            // Cmd+Shift+E for export
            if (event.shiftKey && canExport) {
              event.preventDefault();
              exportAll();
            }
            return;
        }
      }

      // Navigation (no modifiers)
      switch (event.key) {
        case "ArrowDown":
        case "j":
          event.preventDefault();
          selectNext();
          break;

        case "ArrowUp":
        case "k":
          event.preventDefault();
          selectPrevious();
          break;

        case "Escape":
          event.preventDefault();
          selectEvent(null);
          break;

        // Quick search
        case "/":
          event.preventDefault();
          document
            .querySelector<HTMLInputElement>("[data-search-input]")
            ?.focus();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectNext,
    selectPrevious,
    selectEvent,
    clearEvents,
    toggleRecording,
    exportAll,
    canExport,
    setSearchQuery,
  ]);
}
