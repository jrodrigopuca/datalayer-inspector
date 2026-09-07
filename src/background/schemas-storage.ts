/**
 * Service Worker - Schemas Storage
 *
 * The ONLY writer of the schema list. Panels send mutation ops; this module
 * applies them in order, persists the result to chrome.storage.local and
 * returns the authoritative list (docs/TECH-DEBT.md, item 4).
 *
 * Ops are queued so two panels mutating at the same time never interleave
 * their read-modify-write and lose each other's change.
 */

import { STORAGE_KEYS } from "@shared/constants";
import type { Schema, SchemaOp } from "@shared/types";
import { applySchemaOp } from "@shared/utils/schema-ops";
import { isSchema } from "@shared/validators";

/**
 * Cached authoritative list (null until first read)
 */
let cachedSchemas: readonly Schema[] | null = null;

/**
 * Serializes mutations: each op waits for the previous one to finish
 */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Read the schema list (cached after the first successful read)
 */
export async function getSchemas(): Promise<readonly Schema[]> {
  if (cachedSchemas) {
    return cachedSchemas;
  }

  try {
    const key = STORAGE_KEYS.SCHEMAS;
    const result = await chrome.storage.local.get(key);
    const stored: unknown = result[key];

    if (!Array.isArray(stored)) {
      cachedSchemas = [];
      return cachedSchemas;
    }

    const valid = stored.filter(isSchema);
    if (valid.length !== stored.length) {
      console.warn(
        `[Strata] Ignoring ${stored.length - valid.length} malformed stored schema(s)`
      );
    }

    cachedSchemas = valid;
    return cachedSchemas;
  } catch (error) {
    console.error("[Strata] Failed to load schemas:", error);
    return [];
  }
}

/**
 * Apply one mutation, persist, and return the resulting list.
 *
 * Rejects when persistence fails; the cache is left untouched so the next
 * op starts from the last persisted list.
 */
export function applySchemaOperation(op: SchemaOp): Promise<readonly Schema[]> {
  const run = queue.then(async () => {
    const current = await getSchemas();
    const next = applySchemaOp(current, op);

    if (next !== current) {
      await chrome.storage.local.set({ [STORAGE_KEYS.SCHEMAS]: next });
      cachedSchemas = next;
    }

    return next;
  });

  // Keep the chain alive even if this op fails
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Drop the cache and pending chain (for testing)
 */
export function clearSchemasCache(): void {
  cachedSchemas = null;
  queue = Promise.resolve();
}
