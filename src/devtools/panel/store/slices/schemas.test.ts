import { SCHEMA_OP, type Schema } from "@shared/types";
import { beforeEach, describe, expect, it } from "vitest";
import { usePanelStore } from "../index";

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

describe("schemas slice", () => {
  beforeEach(() => {
    usePanelStore.setState({
      schemas: [schema("a")],
      validations: new Map(),
      _schemaVersion: 0,
    });
  });

  it("applies an op and bumps the version", () => {
    usePanelStore.getState().applySchemaOp({
      op: SCHEMA_OP.ADD,
      schema: schema("b"),
    });

    const state = usePanelStore.getState();
    expect(state.schemas.map((s) => s.id)).toEqual(["a", "b"]);
    expect(state._schemaVersion).toBe(1);
  });

  it("does not bump the version for a no-op", () => {
    usePanelStore.getState().applySchemaOp({ op: SCHEMA_OP.DELETE, id: "zzz" });

    expect(usePanelStore.getState()._schemaVersion).toBe(0);
  });

  it("setSchemas ignores an identical list (worker echo of our own edit)", () => {
    const before = usePanelStore.getState().schemas;

    usePanelStore.getState().setSchemas([schema("a")]);

    const state = usePanelStore.getState();
    expect(state.schemas).toBe(before);
    expect(state._schemaVersion).toBe(0);
  });

  it("setSchemas adopts a different list (edit from another panel)", () => {
    usePanelStore.getState().setSchemas([schema("a"), schema("b")]);

    const state = usePanelStore.getState();
    expect(state.schemas.map((s) => s.id)).toEqual(["a", "b"]);
    expect(state._schemaVersion).toBe(1);
  });
});
