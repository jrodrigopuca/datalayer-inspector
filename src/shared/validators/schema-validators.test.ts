import { describe, expect, it } from "vitest";
import { CLIENT_REQUEST_TYPE, SCHEMA_OP } from "../types";
import {
  isClientToBackgroundRequest,
  isSchema,
  isSchemaOp,
} from "./message-validators";

const VALID_SCHEMA = {
  id: "s1",
  name: "Purchase",
  template: { event: "purchase" },
  enabled: true,
  createdAt: 1,
  updatedAt: 2,
};

describe("isSchema", () => {
  it("accepts a well-formed schema, with or without description", () => {
    expect(isSchema(VALID_SCHEMA)).toBe(true);
    expect(isSchema({ ...VALID_SCHEMA, description: "GA4" })).toBe(true);
  });

  it("rejects missing or mistyped fields", () => {
    expect(isSchema(null)).toBe(false);
    expect(isSchema([])).toBe(false);
    expect(isSchema({ ...VALID_SCHEMA, id: 1 })).toBe(false);
    expect(isSchema({ ...VALID_SCHEMA, template: [] })).toBe(false);
    expect(isSchema({ ...VALID_SCHEMA, enabled: "yes" })).toBe(false);
    expect(isSchema({ ...VALID_SCHEMA, description: 5 })).toBe(false);
    const { createdAt: _c, ...noCreatedAt } = VALID_SCHEMA;
    expect(isSchema(noCreatedAt)).toBe(false);
  });
});

describe("isSchemaOp", () => {
  it("accepts every op shape", () => {
    expect(isSchemaOp({ op: SCHEMA_OP.ADD, schema: VALID_SCHEMA })).toBe(true);
    expect(
      isSchemaOp({
        op: SCHEMA_OP.UPDATE,
        id: "s1",
        input: { name: "x", enabled: false },
        updatedAt: 3,
      })
    ).toBe(true);
    expect(isSchemaOp({ op: SCHEMA_OP.DELETE, id: "s1" })).toBe(true);
    expect(
      isSchemaOp({
        op: SCHEMA_OP.IMPORT,
        schemas: [VALID_SCHEMA, VALID_SCHEMA],
      })
    ).toBe(true);
  });

  it("rejects unknown ops and malformed payloads", () => {
    expect(isSchemaOp({ op: "nuke" })).toBe(false);
    expect(isSchemaOp({ op: SCHEMA_OP.ADD, schema: { id: "x" } })).toBe(false);
    expect(
      isSchemaOp({
        op: SCHEMA_OP.UPDATE,
        id: "s1",
        input: { enabled: "no" },
        updatedAt: 3,
      })
    ).toBe(false);
    expect(isSchemaOp({ op: SCHEMA_OP.UPDATE, id: "s1", input: {} })).toBe(
      false
    );
    expect(isSchemaOp({ op: SCHEMA_OP.DELETE })).toBe(false);
    expect(
      isSchemaOp({
        op: SCHEMA_OP.IMPORT,
        schemas: [VALID_SCHEMA, { id: "bad" }],
      })
    ).toBe(false);
  });
});

describe("isClientToBackgroundRequest (schemas)", () => {
  it("accepts GET_SCHEMAS without payload", () => {
    expect(
      isClientToBackgroundRequest({ type: CLIENT_REQUEST_TYPE.GET_SCHEMAS })
    ).toBe(true);
  });

  it("accepts UPDATE_SCHEMAS with a valid op only", () => {
    expect(
      isClientToBackgroundRequest({
        type: CLIENT_REQUEST_TYPE.UPDATE_SCHEMAS,
        payload: { op: { op: SCHEMA_OP.DELETE, id: "s1" } },
      })
    ).toBe(true);
    expect(
      isClientToBackgroundRequest({
        type: CLIENT_REQUEST_TYPE.UPDATE_SCHEMAS,
        payload: { op: { op: "drop-table" } },
      })
    ).toBe(false);
    expect(
      isClientToBackgroundRequest({ type: CLIENT_REQUEST_TYPE.UPDATE_SCHEMAS })
    ).toBe(false);
  });
});
