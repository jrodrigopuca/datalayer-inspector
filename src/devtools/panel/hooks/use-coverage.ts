/**
 * useCoverage hook - schema coverage over captured events
 *
 * Answers the QA question validation alone can't: which expected
 * events (enabled schemas) never fired during this session?
 */

import type { Schema } from "@shared/types";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePanelStore } from "../store";

export interface SchemaCoverage {
  /** Number of enabled schemas */
  enabledCount: number;
  /** Enabled schemas that matched at least one captured event */
  firedCount: number;
  /** Enabled schemas that never matched any event */
  missing: readonly Schema[];
}

export function useCoverage(): SchemaCoverage {
  const { schemas, validations } = usePanelStore(
    useShallow((s) => ({
      schemas: s.schemas,
      validations: s.validations,
    }))
  );

  return useMemo(() => {
    const firedSchemaIds = new Set<string>();
    for (const validation of validations.values()) {
      for (const result of validation.results) {
        firedSchemaIds.add(result.schemaId);
      }
    }

    const enabledSchemas = schemas.filter((s) => s.enabled);
    const missing = enabledSchemas.filter((s) => !firedSchemaIds.has(s.id));

    return {
      enabledCount: enabledSchemas.length,
      firedCount: enabledSchemas.length - missing.length,
      missing,
    };
  }, [schemas, validations]);
}
