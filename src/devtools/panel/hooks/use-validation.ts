/**
 * useValidation hook - validates events against schemas
 *
 * Provides validation results and re-validates when events/schemas change
 * Uses incremental validation for new events to avoid O(n) re-validation
 */

import { useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePanelStore } from "../store";
import type { EventValidation } from "@shared/types";

interface UseValidationReturn {
  /** Get validation result for a specific event */
  getValidation: (eventId: string) => EventValidation | undefined;
  /** Map of all validation results by event ID */
  validations: Map<string, EventValidation>;
  /** Summary counts */
  summary: {
    total: number;
    passed: number;
    failed: number;
    unchecked: number;
  };
}

/**
 * Hook for accessing validation results
 */
export function useValidation(): UseValidationReturn {
  const { 
    events, 
    schemas, 
    validations, 
    validateEvents, 
    validateNewEvents,
    getValidation,
    _schemaVersion,
  } = usePanelStore(
    useShallow((s) => ({
      events: s.events,
      schemas: s.schemas,
      validations: s.validations,
      validateEvents: s.validateEvents,
      validateNewEvents: s.validateNewEvents,
      getValidation: s.getValidation,
      _schemaVersion: s._schemaVersion,
    }))
  );

  // Track previously validated event IDs and schema version
  const prevEventIdsRef = useRef<Set<string>>(new Set());
  const prevSchemaVersionRef = useRef<number>(_schemaVersion);

  // Re-validate when events or schemas change
  useEffect(() => {
    if (events.length === 0 || schemas.length === 0) return;
    
    const schemaChanged = prevSchemaVersionRef.current !== _schemaVersion;
    
    if (schemaChanged) {
      // Schema changed - full re-validation needed
      validateEvents(events);
      prevSchemaVersionRef.current = _schemaVersion;
      prevEventIdsRef.current = new Set(events.map(e => e.id));
    } else {
      // Find new events (not previously validated)
      const currentIds = new Set(events.map(e => e.id));
      const newEventIds = new Set<string>();
      
      for (const id of currentIds) {
        if (!prevEventIdsRef.current.has(id)) {
          newEventIds.add(id);
        }
      }
      
      if (newEventIds.size > 0) {
        // Only validate new events
        validateNewEvents(events, newEventIds);
      }
      
      prevEventIdsRef.current = currentIds;
    }
  }, [events, schemas, _schemaVersion, validateEvents, validateNewEvents]);

  // Compute summary
  const summary = useMemo(() => {
    let passed = 0;
    let failed = 0;
    let unchecked = 0;

    for (const validation of validations.values()) {
      switch (validation.status) {
        case "pass":
          passed++;
          break;
        case "fail":
          failed++;
          break;
        case "none":
          unchecked++;
          break;
      }
    }

    return {
      total: validations.size,
      passed,
      failed,
      unchecked,
    };
  }, [validations]);

  return {
    getValidation,
    validations,
    summary,
  };
}

/**
 * Hook to get validation for a single event
 */
export function useEventValidation(eventId: string): EventValidation | undefined {
  const getValidation = usePanelStore((s) => s.getValidation);
  return getValidation(eventId);
}
