/**
 * useExport hook - handles JSON export of dataLayer events
 *
 * Provides functions to export all events or only filtered events
 */

import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePanelStore } from "../store";
import { selectFilteredEvents } from "../store/selectors";
import { exportEventsAsJSON, type ExportOptions } from "@shared/utils";

interface UseExportReturn {
  /** Export all captured events */
  exportAll: (options?: ExportOptions) => void;
  /** Export only the currently filtered events */
  exportFiltered: (options?: ExportOptions) => void;
  /** Whether there are events to export */
  canExport: boolean;
  /** Total events available */
  totalEvents: number;
  /** Filtered events count */
  filteredEventsCount: number;
}

/**
 * Hook for exporting dataLayer events as JSON
 *
 * @example
 * ```tsx
 * const { exportAll, exportFiltered, canExport } = useExport();
 *
 * return (
 *   <Button onClick={() => exportAll()} disabled={!canExport}>
 *     Export JSON
 *   </Button>
 * );
 * ```
 */
export function useExport(): UseExportReturn {
  const { events, containers } = usePanelStore(
    useShallow((s) => ({
      events: s.events,
      containers: s.containers,
    }))
  );

  const filteredEvents = usePanelStore(useShallow(selectFilteredEvents));

  // Get current URL from the inspected tab
  const getCurrentUrl = useCallback((): string => {
    // In DevTools context, we can get the URL from the last event
    // or fall back to a default
    const lastEvent = events[events.length - 1];
    if (lastEvent) {
      return lastEvent.url;
    }
    return window.location.href;
  }, [events]);

  const exportAll = useCallback(
    (options?: ExportOptions): void => {
      if (events.length === 0) return;

      const currentUrl = getCurrentUrl();
      exportEventsAsJSON(events, containers, currentUrl, options);
    },
    [events, containers, getCurrentUrl]
  );

  const exportFiltered = useCallback(
    (options?: ExportOptions): void => {
      if (filteredEvents.length === 0) return;

      const currentUrl = getCurrentUrl();
      exportEventsAsJSON(filteredEvents, containers, currentUrl, options);
    },
    [filteredEvents, containers, getCurrentUrl]
  );

  return {
    exportAll,
    exportFiltered,
    canExport: events.length > 0,
    totalEvents: events.length,
    filteredEventsCount: filteredEvents.length,
  };
}
