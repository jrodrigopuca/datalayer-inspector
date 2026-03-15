/**
 * useSchemas hook - manages validation schemas
 *
 * Handles CRUD operations and syncs with chrome.storage
 */

import { useEffect, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePanelStore } from "../store";
import type {
  Schema,
  CreateSchemaInput,
  UpdateSchemaInput,
  DataLayerEvent,
  TemplateObject,
} from "@shared/types";
import { eventToTemplate } from "@shared/validators";

const STORAGE_KEY = "strata_schemas";

interface UseSchemasReturn {
  /** All schemas */
  schemas: readonly Schema[];
  /** Add a new schema */
  addSchema: (input: CreateSchemaInput) => Schema;
  /** Update an existing schema */
  updateSchema: (id: string, input: UpdateSchemaInput) => void;
  /** Delete a schema */
  deleteSchema: (id: string) => void;
  /** Toggle schema enabled state */
  toggleSchema: (id: string) => void;
  /** Create schema from an existing event */
  createSchemaFromEvent: (event: DataLayerEvent, name?: string) => Schema;
  /** Import schemas from JSON */
  importSchemas: (schemas: Schema[]) => void;
  /** Export all schemas */
  exportSchemas: () => Schema[];
}

/**
 * Hook for managing validation schemas
 */
export function useSchemas(): UseSchemasReturn {
  const {
    schemas,
    addSchema: storeAddSchema,
    updateSchema: storeUpdateSchema,
    deleteSchema: storeDeleteSchema,
    toggleSchemaEnabled,
    setSchemas,
  } = usePanelStore(
    useShallow((s) => ({
      schemas: s.schemas,
      addSchema: s.addSchema,
      updateSchema: s.updateSchema,
      deleteSchema: s.deleteSchema,
      toggleSchemaEnabled: s.toggleSchemaEnabled,
      setSchemas: s.setSchemas,
    }))
  );

  // Load schemas from storage on mount
  useEffect(() => {
    async function loadSchemas(): Promise<void> {
      try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const stored = result[STORAGE_KEY];
        if (Array.isArray(stored)) {
          setSchemas(stored as Schema[]);
        }
      } catch (error) {
        console.error("[Strata] Failed to load schemas:", error);
      }
    }

    loadSchemas();
  }, [setSchemas]);

  // Save schemas to storage when they change
  useEffect(() => {
    async function saveSchemas(): Promise<void> {
      try {
        await chrome.storage.local.set({ [STORAGE_KEY]: schemas });
      } catch (error) {
        console.error("[Strata] Failed to save schemas:", error);
      }
    }

    // Only save if we have schemas (avoid clearing on initial load)
    if (schemas.length > 0) {
      saveSchemas();
    }
  }, [schemas]);

  const addSchema = useCallback(
    (input: CreateSchemaInput): Schema => {
      return storeAddSchema(input);
    },
    [storeAddSchema]
  );

  const updateSchema = useCallback(
    (id: string, input: UpdateSchemaInput): void => {
      storeUpdateSchema(id, input);
    },
    [storeUpdateSchema]
  );

  const deleteSchema = useCallback(
    (id: string): void => {
      storeDeleteSchema(id);
    },
    [storeDeleteSchema]
  );

  const toggleSchema = useCallback(
    (id: string): void => {
      toggleSchemaEnabled(id);
    },
    [toggleSchemaEnabled]
  );

  const createSchemaFromEvent = useCallback(
    (event: DataLayerEvent, name?: string): Schema => {
      const template: TemplateObject = eventToTemplate(event.data);
      const schemaName =
        name || `${event.eventName || "Unknown Event"} Schema`;

      return storeAddSchema({
        name: schemaName,
        template,
      });
    },
    [storeAddSchema]
  );

  const importSchemas = useCallback(
    (newSchemas: Schema[]): void => {
      // Merge with existing, replacing duplicates by ID
      const existingIds = new Set(schemas.map((s) => s.id));
      const toAdd = newSchemas.filter((s) => !existingIds.has(s.id));
      const toUpdate = newSchemas.filter((s) => existingIds.has(s.id));

      // Update existing
      for (const schema of toUpdate) {
        const update: UpdateSchemaInput = {
          name: schema.name,
          template: schema.template,
          enabled: schema.enabled,
        };
        if (schema.description) {
          update.description = schema.description;
        }
        storeUpdateSchema(schema.id, update);
      }

      // Add new
      for (const schema of toAdd) {
        const input: CreateSchemaInput = {
          name: schema.name,
          template: schema.template,
          enabled: schema.enabled,
        };
        if (schema.description) {
          input.description = schema.description;
        }
        storeAddSchema(input);
      }
    },
    [schemas, storeAddSchema, storeUpdateSchema]
  );

  const exportSchemas = useCallback((): Schema[] => {
    return [...schemas];
  }, [schemas]);

  return {
    schemas,
    addSchema,
    updateSchema,
    deleteSchema,
    toggleSchema,
    createSchemaFromEvent,
    importSchemas,
    exportSchemas,
  };
}
