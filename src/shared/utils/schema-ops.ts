/**
 * Apply a schema mutation to a schema list.
 *
 * Single implementation shared by the service worker (authoritative) and the
 * DevTools panel (optimistic mirror). Pure and deterministic: given the same
 * list and the same op, both sides produce the same list, so the worker's
 * broadcast matches the panel's local state byte for byte.
 *
 * Returns the SAME array reference when the op changes nothing, so callers
 * can skip persistence and re-validation cheaply.
 */

import { SCHEMA_OP, type Schema, type SchemaOp } from "../types/schema";

function upsert(list: readonly Schema[], schema: Schema): readonly Schema[] {
  const index = list.findIndex((s) => s.id === schema.id);
  if (index === -1) {
    return [...list, schema];
  }
  const next = [...list];
  next[index] = schema;
  return next;
}

export function applySchemaOp(
  schemas: readonly Schema[],
  op: SchemaOp
): readonly Schema[] {
  switch (op.op) {
    case SCHEMA_OP.ADD:
      return upsert(schemas, op.schema);

    case SCHEMA_OP.UPDATE: {
      let changed = false;
      const next = schemas.map((schema) => {
        if (schema.id !== op.id) return schema;
        changed = true;
        return { ...schema, ...op.input, updatedAt: op.updatedAt };
      });
      return changed ? next : schemas;
    }

    case SCHEMA_OP.DELETE: {
      const next = schemas.filter((schema) => schema.id !== op.id);
      return next.length === schemas.length ? schemas : next;
    }

    case SCHEMA_OP.IMPORT: {
      let next = schemas;
      for (const schema of op.schemas) {
        next = upsert(next, schema);
      }
      return next;
    }

    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
}
