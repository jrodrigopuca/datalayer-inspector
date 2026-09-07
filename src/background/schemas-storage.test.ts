import { STORAGE_KEYS } from "@shared/constants";
import { SCHEMA_OP, type Schema } from "@shared/types";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
  applySchemaOperation,
  clearSchemasCache,
  getSchemas,
} from "./schemas-storage";

const mocked = (fn: unknown): Mock => fn as Mock;

function schema(id: string, overrides: Partial<Schema> = {}): Schema {
  return {
    id,
    name: `Schema ${id}`,
    template: { event: id },
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function stored(schemas: unknown[]): void {
  mocked(chrome.storage.local.get).mockResolvedValue({
    [STORAGE_KEYS.SCHEMAS]: schemas,
  });
}

describe("schemas-storage", () => {
  beforeEach(() => {
    clearSchemasCache();
    mocked(chrome.storage.local.get).mockResolvedValue({});
    mocked(chrome.storage.local.set).mockResolvedValue(undefined);
  });

  describe("getSchemas", () => {
    it("returns an empty list when nothing is stored", async () => {
      await expect(getSchemas()).resolves.toEqual([]);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(
        STORAGE_KEYS.SCHEMAS
      );
    });

    it("reads the list written by pre-1.5 panels (same key, same shape)", async () => {
      stored([schema("a"), schema("b")]);

      const schemas = await getSchemas();

      expect(schemas.map((s) => s.id)).toEqual(["a", "b"]);
    });

    it("drops malformed entries with a warning", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      stored([schema("a"), { id: "broken" }, null]);

      const schemas = await getSchemas();

      expect(schemas.map((s) => s.id)).toEqual(["a"]);
      expect(warnSpy).toHaveBeenCalledOnce();
      warnSpy.mockRestore();
    });

    it("caches after the first read", async () => {
      await getSchemas();
      await getSchemas();

      expect(chrome.storage.local.get).toHaveBeenCalledTimes(1);
    });

    it("returns an empty list (uncached) when storage fails", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mocked(chrome.storage.local.get).mockRejectedValue(new Error("boom"));

      await expect(getSchemas()).resolves.toEqual([]);
      await getSchemas();
      expect(chrome.storage.local.get).toHaveBeenCalledTimes(2);
      errorSpy.mockRestore();
    });
  });

  describe("applySchemaOperation", () => {
    it("applies the op, persists and returns the new list", async () => {
      stored([schema("a")]);

      const result = await applySchemaOperation({
        op: SCHEMA_OP.ADD,
        schema: schema("b"),
      });

      expect(result.map((s) => s.id)).toEqual(["a", "b"]);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEYS.SCHEMAS]: result,
      });
      await expect(getSchemas()).resolves.toBe(result);
    });

    it("skips the write when the op changes nothing", async () => {
      stored([schema("a")]);

      await applySchemaOperation({ op: SCHEMA_OP.DELETE, id: "zzz" });

      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it("serializes concurrent ops so none is lost", async () => {
      stored([]);

      // Two panels fire at the same time, without awaiting each other
      const fromPanelA = applySchemaOperation({
        op: SCHEMA_OP.ADD,
        schema: schema("a"),
      });
      const fromPanelB = applySchemaOperation({
        op: SCHEMA_OP.ADD,
        schema: schema("b"),
      });

      const [afterA, afterB] = await Promise.all([fromPanelA, fromPanelB]);

      expect(afterA.map((s) => s.id)).toEqual(["a"]);
      expect(afterB.map((s) => s.id)).toEqual(["a", "b"]);
      await expect(getSchemas()).resolves.toEqual(afterB);
    });

    it("rejects on persist failure and keeps the last good list", async () => {
      stored([schema("a")]);
      mocked(chrome.storage.local.set).mockRejectedValueOnce(
        new Error("QUOTA_BYTES quota exceeded")
      );

      await expect(
        applySchemaOperation({ op: SCHEMA_OP.ADD, schema: schema("b") })
      ).rejects.toThrow("quota");

      const schemas = await getSchemas();
      expect(schemas.map((s) => s.id)).toEqual(["a"]);
    });

    it("keeps processing ops after one fails", async () => {
      stored([]);
      mocked(chrome.storage.local.set).mockRejectedValueOnce(new Error("x"));

      await expect(
        applySchemaOperation({ op: SCHEMA_OP.ADD, schema: schema("a") })
      ).rejects.toThrow();
      const result = await applySchemaOperation({
        op: SCHEMA_OP.ADD,
        schema: schema("b"),
      });

      expect(result.map((s) => s.id)).toEqual(["b"]);
    });
  });
});
