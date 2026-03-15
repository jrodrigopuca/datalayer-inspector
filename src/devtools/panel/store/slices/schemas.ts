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

  // Schema CRUD
  addSchema: (input: CreateSchemaInput) => Schema;
  updateSchema: (id: string, input: UpdateSchemaInput) => void;
  deleteSchema: (id: string) => void;
  setSchemas: (schemas: readonly Schema[]) => void;
  toggleSchemaEnabled: (id: string) => void;

  // Validation
  validateEvents: (events: readonly DataLayerEvent[]) => void;
  getValidation: (eventId: string) => EventValidation | undefined;
  clearValidations: () => void;
}

export const createSchemasSlice: StateCreator<
  SchemasSlice,
  [],
  [],
  SchemasSlice
> = (set, get) => ({
  schemas: [],
  validations: new Map(),

  addSchema: (input) => {
    const schema = createSchema(input);
    set((state) => ({
      schemas: [...state.schemas, schema],
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
    })),

  deleteSchema: (id) =>
    set((state) => ({
      schemas: state.schemas.filter((s) => s.id !== id),
    })),

  setSchemas: (schemas) => set({ schemas }),

  toggleSchemaEnabled: (id) =>
    set((state) => ({
      schemas: state.schemas.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled, updatedAt: Date.now() } : s
      ),
    })),

  validateEvents: (events) => {
    const { schemas } = get();
    const validations = new Map<string, EventValidation>();

    for (const event of events) {
      validations.set(event.id, validateEvent(event, schemas));
    }

    set({ validations });
  },

  getValidation: (eventId) => {
    return get().validations.get(eventId);
  },

  clearValidations: () => set({ validations: new Map() }),
});
