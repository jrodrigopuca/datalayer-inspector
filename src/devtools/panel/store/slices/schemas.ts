/**
 * Schemas slice - mirrors the service worker's authoritative schema list
 *
 * Mutations go through `applySchemaOp` (optimistic, same pure function the
 * worker uses); the worker's SCHEMAS_CHANGED broadcast lands in `setSchemas`,
 * which is a no-op when the list already matches (docs/TECH-DEBT.md, item 4).
 */

import type {
  DataLayerEvent,
  EventValidation,
  Schema,
  SchemaOp,
} from "@shared/types";
import { applySchemaOp } from "@shared/utils/schema-ops";
import { validateEvent } from "@shared/validators";
import type { StateCreator } from "zustand";

export interface SchemasSlice {
  /** All validation schemas */
  schemas: readonly Schema[];
  /** Cached validation results per event ID */
  validations: Map<string, EventValidation>;
  /** Track schema version for cache invalidation */
  _schemaVersion: number;

  // Schema mutations
  /** Apply a mutation locally (the hook also sends it to the worker) */
  applySchemaOp: (op: SchemaOp) => void;
  /** Replace the list with the worker's; no-op if identical */
  setSchemas: (schemas: readonly Schema[]) => void;

  // Validation
  /** Validate all events (full re-validation, use sparingly) */
  validateEvents: (events: readonly DataLayerEvent[]) => void;
  /** Validate only new events (incremental, preferred) */
  validateNewEvents: (
    allEvents: readonly DataLayerEvent[],
    newEventIds: Set<string>
  ) => void;
  getValidation: (eventId: string) => EventValidation | undefined;
  clearValidations: () => void;
  /** Invalidate all validations (call when schemas change) */
  invalidateValidations: () => void;
}

function sameSchemas(a: readonly Schema[], b: readonly Schema[]): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

export const createSchemasSlice: StateCreator<
  SchemasSlice,
  [],
  [],
  SchemasSlice
> = (set, get) => ({
  schemas: [],
  validations: new Map(),
  _schemaVersion: 0,

  applySchemaOp: (op) =>
    set((state) => {
      const schemas = applySchemaOp(state.schemas, op);
      if (schemas === state.schemas) return {};
      return { schemas, _schemaVersion: state._schemaVersion + 1 };
    }),

  setSchemas: (schemas) =>
    set((state) => {
      if (sameSchemas(state.schemas, schemas)) return {};
      return { schemas, _schemaVersion: state._schemaVersion + 1 };
    }),

  validateEvents: (events) => {
    const { schemas } = get();
    const validations = new Map<string, EventValidation>();

    for (const event of events) {
      validations.set(event.id, validateEvent(event, schemas));
    }

    set({ validations });
  },

  validateNewEvents: (allEvents, newEventIds) => {
    const { schemas, validations: existingValidations } = get();

    // If no new events, nothing to do
    if (newEventIds.size === 0) return;

    // Create new map with existing validations
    const validations = new Map(existingValidations);

    // Only validate new events
    for (const event of allEvents) {
      if (newEventIds.has(event.id)) {
        validations.set(event.id, validateEvent(event, schemas));
      }
    }

    set({ validations });
  },

  getValidation: (eventId) => {
    return get().validations.get(eventId);
  },

  clearValidations: () => set({ validations: new Map() }),

  invalidateValidations: () => set({ validations: new Map() }),
});
