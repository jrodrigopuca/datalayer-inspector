/**
 * useSchemas hook - schema CRUD for the panel
 *
 * Every mutation is a SchemaOp: applied to the local store right away
 * (optimistic) and sent to the service worker, the single owner of
 * persistence. The worker answers every client with SCHEMAS_CHANGED, which
 * use-connection feeds back into the store (docs/TECH-DEBT.md, item 4).
 */

import { sendRequest } from "@shared/messaging/client";
import type {
  CreateSchemaInput,
  DataLayerEvent,
  Schema,
  SchemaOp,
  TemplateObject,
  UpdateSchemaInput,
} from "@shared/types";
import {
  CLIENT_REQUEST_TYPE,
  CLIENT_RESPONSE_TYPE,
  createSchema,
  SCHEMA_OP,
} from "@shared/types";
import { eventToTemplate } from "@shared/validators";
import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePanelStore } from "../store";

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
  /** Import schemas from JSON (merge by id) */
  importSchemas: (schemas: Schema[]) => void;
  /** Export all schemas */
  exportSchemas: () => Schema[];
}

/**
 * Send a mutation to the worker; surface failures in the status bar
 */
async function persistOp(op: SchemaOp): Promise<void> {
  try {
    const response = await sendRequest({
      type: CLIENT_REQUEST_TYPE.UPDATE_SCHEMAS,
      payload: { op },
    });
    if (response.type === CLIENT_RESPONSE_TYPE.ERROR) {
      throw new Error(response.payload.message);
    }
  } catch (error) {
    console.error("[Strata] Failed to persist schema change:", error);
    usePanelStore
      .getState()
      .setWarningMessage("Schema change could not be saved");
  }
}

/**
 * Hook for managing validation schemas
 */
export function useSchemas(): UseSchemasReturn {
  const { schemas, applyOp } = usePanelStore(
    useShallow((s) => ({
      schemas: s.schemas,
      applyOp: s.applySchemaOp,
    }))
  );

  const mutate = useCallback(
    (op: SchemaOp): void => {
      applyOp(op);
      void persistOp(op);
    },
    [applyOp]
  );

  const addSchema = useCallback(
    (input: CreateSchemaInput): Schema => {
      const schema = createSchema(input);
      mutate({ op: SCHEMA_OP.ADD, schema });
      return schema;
    },
    [mutate]
  );

  const updateSchema = useCallback(
    (id: string, input: UpdateSchemaInput): void => {
      mutate({ op: SCHEMA_OP.UPDATE, id, input, updatedAt: Date.now() });
    },
    [mutate]
  );

  const deleteSchema = useCallback(
    (id: string): void => {
      mutate({ op: SCHEMA_OP.DELETE, id });
    },
    [mutate]
  );

  const toggleSchema = useCallback(
    (id: string): void => {
      const current = schemas.find((s) => s.id === id);
      if (!current) return;
      // Explicit target state (not "flip") so concurrent panels converge
      mutate({
        op: SCHEMA_OP.UPDATE,
        id,
        input: { enabled: !current.enabled },
        updatedAt: Date.now(),
      });
    },
    [schemas, mutate]
  );

  const createSchemaFromEvent = useCallback(
    (event: DataLayerEvent, name?: string): Schema => {
      const template: TemplateObject = eventToTemplate(event.data);
      const schemaName = name || `${event.eventName || "Unknown Event"} Schema`;

      return addSchema({ name: schemaName, template });
    },
    [addSchema]
  );

  const importSchemas = useCallback(
    (incoming: Schema[]): void => {
      if (incoming.length === 0) return;

      const now = Date.now();
      const existingById = new Map(schemas.map((s) => [s.id, s]));

      // Existing ids keep their identity and creation date; new ones are
      // created fresh (new id) so a file can be imported into any profile.
      const merged: Schema[] = incoming.map((schema) => {
        const existing = existingById.get(schema.id);
        if (existing) {
          return {
            ...existing,
            name: schema.name,
            template: schema.template,
            enabled: schema.enabled,
            updatedAt: now,
            ...(schema.description ? { description: schema.description } : {}),
          };
        }

        return createSchema({
          name: schema.name,
          template: schema.template,
          enabled: schema.enabled,
          ...(schema.description ? { description: schema.description } : {}),
        });
      });

      mutate({ op: SCHEMA_OP.IMPORT, schemas: merged });
    },
    [schemas, mutate]
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
