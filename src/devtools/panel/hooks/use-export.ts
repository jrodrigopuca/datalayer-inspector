/**
 * useExport hook - handles JSON export of dataLayer events
 *
 * Provides functions to export all events or only filtered events
 */

import {
  type ExportOptions,
  exportDataLayerOnly,
  exportEventsAsJSON,
} from "@shared/utils";
import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePanelStore } from "../store";
import { selectFilteredEvents } from "../store/selectors";

interface UseExportReturn {
  /** Export all captured events */
  exportAll: (options?: ExportOptions) => void;
  /** Export only the currently filtered events */
  exportFiltered: (options?: ExportOptions) => void;
  /** Export just the pushed objects, as a plain array (no Strata metadata) */
  exportDataLayer: () => void;
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
  const { events, containers, validations } = usePanelStore(
    useShallow((s) => ({
      events: s.events,
      containers: s.containers,
      validations: s.validations,
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
      exportEventsAsJSON(events, containers, currentUrl, {
        validations,
        ...options,
      });
    },
    [events, containers, validations, getCurrentUrl]
  );

  const exportFiltered = useCallback(
    (options?: ExportOptions): void => {
      if (filteredEvents.length === 0) return;

      const currentUrl = getCurrentUrl();
      exportEventsAsJSON(filteredEvents, containers, currentUrl, {
        validations,
        ...options,
      });
    },
    [filteredEvents, containers, validations, getCurrentUrl]
  );

  const exportDataLayer = useCallback((): void => {
    if (events.length === 0) return;
    exportDataLayerOnly(events, getCurrentUrl());
  }, [events, getCurrentUrl]);

  return {
    exportAll,
    exportFiltered,
    exportDataLayer,
    canExport: events.length > 0,
    totalEvents: events.length,
    filteredEventsCount: filteredEvents.length,
  };
}
