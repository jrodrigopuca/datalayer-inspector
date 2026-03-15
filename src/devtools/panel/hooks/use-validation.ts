/**
 * useValidation hook - validates events against schemas
 *
 * Provides validation results and re-validates when events/schemas change
 */

import { useEffect, useMemo } from "react";
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
  const { events, schemas, validations, validateEvents, getValidation } =
    usePanelStore(
      useShallow((s) => ({
        events: s.events,
        schemas: s.schemas,
        validations: s.validations,
        validateEvents: s.validateEvents,
        getValidation: s.getValidation,
      }))
    );

  // Re-validate when events or schemas change
  useEffect(() => {
    if (events.length > 0 && schemas.length > 0) {
      validateEvents(events);
    }
  }, [events, schemas, validateEvents]);

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
