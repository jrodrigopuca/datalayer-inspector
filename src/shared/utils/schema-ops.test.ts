import { describe, expect, it } from "vitest";
import { SCHEMA_OP, type Schema } from "../types";
import { applySchemaOp } from "./schema-ops";

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

describe("applySchemaOp", () => {
  const base: readonly Schema[] = [schema("a"), schema("b")];

  describe("add", () => {
    it("appends a new schema", () => {
      const next = applySchemaOp(base, {
        op: SCHEMA_OP.ADD,
        schema: schema("c"),
      });

      expect(next.map((s) => s.id)).toEqual(["a", "b", "c"]);
    });

    it("replaces an existing schema with the same id (idempotent)", () => {
      const replacement = schema("b", { name: "B v2" });

      const next = applySchemaOp(base, {
        op: SCHEMA_OP.ADD,
        schema: replacement,
      });

      expect(next.map((s) => s.id)).toEqual(["a", "b"]);
      expect(next[1]).toBe(replacement);
    });
  });

  describe("update", () => {
    it("merges fields and stamps updatedAt from the op", () => {
      const next = applySchemaOp(base, {
        op: SCHEMA_OP.UPDATE,
        id: "a",
        input: { name: "Renamed", enabled: false },
        updatedAt: 42,
      });

      expect(next[0]).toEqual({
        ...schema("a"),
        name: "Renamed",
        enabled: false,
        updatedAt: 42,
      });
      expect(next[1]).toBe(base[1]);
    });

    it("returns the same reference when the id is unknown", () => {
      const next = applySchemaOp(base, {
        op: SCHEMA_OP.UPDATE,
        id: "zzz",
        input: { name: "x" },
        updatedAt: 42,
      });

      expect(next).toBe(base);
    });
  });

  describe("delete", () => {
    it("removes the schema", () => {
      const next = applySchemaOp(base, { op: SCHEMA_OP.DELETE, id: "a" });

      expect(next.map((s) => s.id)).toEqual(["b"]);
    });

    it("returns the same reference when the id is unknown", () => {
      expect(applySchemaOp(base, { op: SCHEMA_OP.DELETE, id: "zzz" })).toBe(
        base
      );
    });
  });

  describe("import", () => {
    it("upserts by id, keeping order for existing and appending new", () => {
      const next = applySchemaOp(base, {
        op: SCHEMA_OP.IMPORT,
        schemas: [schema("b", { name: "B imported" }), schema("c")],
      });

      expect(next.map((s) => s.id)).toEqual(["a", "b", "c"]);
      expect(next[1]?.name).toBe("B imported");
    });

    it("returns the same reference for an empty import", () => {
      expect(applySchemaOp(base, { op: SCHEMA_OP.IMPORT, schemas: [] })).toBe(
        base
      );
    });
  });

  it("is deterministic: same input and op give equal output on both sides", () => {
    const op = {
      op: SCHEMA_OP.UPDATE,
      id: "a",
      input: { template: { event: "purchase", value: "@number" } },
      updatedAt: 99,
    } as const;

    const worker = applySchemaOp(base, op);
    const panel = applySchemaOp(base, op);

    expect(JSON.stringify(worker)).toBe(JSON.stringify(panel));
  });

  it("never mutates the input list", () => {
    const copy = JSON.stringify(base);

    applySchemaOp(base, { op: SCHEMA_OP.DELETE, id: "a" });
    applySchemaOp(base, { op: SCHEMA_OP.ADD, schema: schema("z") });

    expect(JSON.stringify(base)).toBe(copy);
  });
});
