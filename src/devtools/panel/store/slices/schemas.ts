/**
 * Schemas slice - manages validation schemas
 */

import type { StateCreator } from "zustand";
import type {
  Schema,
  CreateSchemaInput,
  UpdateSchemaInput,
  EventValidation,
  DataLayerEvent,
} from "@shared/types";
import { createSchema } from "@shared/types";
import { validateEvent } from "@shared/validators";

export interface SchemasSlice {
  /** All validation schemas */
  schemas: readonly Schema[];
  /** Cached validation results per event ID */
  validations: Map<string, EventValidation>;
  /** Track schema version for cache invalidation */
  _schemaVersion: number;

  // Schema CRUD
  addSchema: (input: CreateSchemaInput) => Schema;
  updateSchema: (id: string, input: UpdateSchemaInput) => void;
  deleteSchema: (id: string) => void;
  setSchemas: (schemas: readonly Schema[]) => void;
  toggleSchemaEnabled: (id: string) => void;

  // Validation
  /** Validate all events (full re-validation, use sparingly) */
  validateEvents: (events: readonly DataLayerEvent[]) => void;
  /** Validate only new events (incremental, preferred) */
  validateNewEvents: (allEvents: readonly DataLayerEvent[], newEventIds: Set<string>) => void;
  getValidation: (eventId: string) => EventValidation | undefined;
  clearValidations: () => void;
  /** Invalidate all validations (call when schemas change) */
  invalidateValidations: () => void;
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

  addSchema: (input) => {
    const schema = createSchema(input);
    set((state) => ({
      schemas: [...state.schemas, schema],
      _schemaVersion: state._schemaVersion + 1,
    }));
    // Re-validate after adding schema
    // Note: This requires events from another slice, will be handled in hook
    return schema;
  },

  updateSchema: (id, input) =>
    set((state) => ({
      schemas: state.schemas.map((s) =>
        s.id === id
          ? {
              ...s,
              ...input,
              updatedAt: Date.now(),
            }
          : s
      ),
      _schemaVersion: state._schemaVersion + 1,
    })),

  deleteSchema: (id) =>
    set((state) => ({
      schemas: state.schemas.filter((s) => s.id !== id),
      _schemaVersion: state._schemaVersion + 1,
    })),

  setSchemas: (schemas) => set((state) => ({ 
    schemas,
    _schemaVersion: state._schemaVersion + 1,
  })),

  toggleSchemaEnabled: (id) =>
    set((state) => ({
      schemas: state.schemas.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled, updatedAt: Date.now() } : s
      ),
      _schemaVersion: state._schemaVersion + 1,
    })),

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
