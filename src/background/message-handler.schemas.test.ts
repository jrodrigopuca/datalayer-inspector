/**
 * Schema requests routed through the service worker (docs/TECH-DEBT.md,
 * items 4 and 7).
 */

import { STORAGE_KEYS } from "@shared/constants";
import {
  BACKGROUND_MESSAGE_TYPE,
  CLIENT_REQUEST_TYPE,
  CLIENT_RESPONSE_TYPE,
  CONTENT_MESSAGE_TYPE,
  PORT_NAME,
  SCHEMA_OP,
  type Schema,
} from "@shared/types";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { handleClientRequest, isClientRequest } from "./message-handler";
import { clearAllPorts, registerPort } from "./port-manager";
import { clearSchemasCache } from "./schemas-storage";
import { clearSettingsCache } from "./storage";

const mocked = (fn: unknown): Mock => fn as Mock;
const SENDER = {} as chrome.runtime.MessageSender;

function schema(id: string): Schema {
  return {
    id,
    name: `Schema ${id}`,
    template: { event: id },
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
  };
}

function connect(name: string, tabId: number): Mock {
  const postMessage = vi.fn();
  registerPort(
    {
      name,
      postMessage,
      disconnect: vi.fn(),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
      onDisconnect: { addListener: vi.fn(), removeListener: vi.fn() },
    } as unknown as chrome.runtime.Port,
    tabId
  );
  return postMessage;
}

describe("isClientRequest", () => {
  it("recognises every client request type, including new ones", () => {
    for (const type of Object.values(CLIENT_REQUEST_TYPE)) {
      expect(isClientRequest({ type })).toBe(true);
    }
  });

  it("does not treat content-script messages as client requests", () => {
    for (const type of Object.values(CONTENT_MESSAGE_TYPE)) {
      expect(isClientRequest({ type })).toBe(false);
    }
    expect(isClientRequest(null)).toBe(false);
    expect(isClientRequest({ type: 42 })).toBe(false);
  });
});

describe("schema requests", () => {
  beforeEach(() => {
    clearAllPorts();
    clearSchemasCache();
    clearSettingsCache();
    mocked(chrome.storage.sync.get).mockResolvedValue({});
    mocked(chrome.storage.local.get).mockResolvedValue({
      [STORAGE_KEYS.SCHEMAS]: [schema("a")],
    });
    mocked(chrome.storage.local.set).mockResolvedValue(undefined);
  });

  it("GET_SCHEMAS returns the stored list", async () => {
    const response = await handleClientRequest(
      { type: CLIENT_REQUEST_TYPE.GET_SCHEMAS },
      SENDER
    );

    expect(response).toEqual({
      type: CLIENT_RESPONSE_TYPE.SCHEMAS,
      payload: { schemas: [schema("a")] },
    });
  });

  it("UPDATE_SCHEMAS applies the op, persists and broadcasts to every client", async () => {
    const panelTab1 = connect(PORT_NAME.DEVTOOLS_PANEL, 1);
    const panelTab2 = connect(PORT_NAME.DEVTOOLS_PANEL, 2);

    const response = await handleClientRequest(
      {
        type: CLIENT_REQUEST_TYPE.UPDATE_SCHEMAS,
        payload: { op: { op: SCHEMA_OP.ADD, schema: schema("b") } },
      },
      SENDER
    );

    const expected = [schema("a"), schema("b")];
    expect(response).toEqual({
      type: CLIENT_RESPONSE_TYPE.SCHEMAS,
      payload: { schemas: expected },
    });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEYS.SCHEMAS]: expected,
    });
    const broadcast = {
      type: BACKGROUND_MESSAGE_TYPE.SCHEMAS_CHANGED,
      payload: { schemas: expected },
    };
    expect(panelTab1).toHaveBeenCalledWith(broadcast);
    expect(panelTab2).toHaveBeenCalledWith(broadcast);
  });

  it("UPDATE_SCHEMAS rejects a malformed op before touching storage", async () => {
    const response = await handleClientRequest(
      {
        type: CLIENT_REQUEST_TYPE.UPDATE_SCHEMAS,
        payload: { op: { op: SCHEMA_OP.ADD, schema: { id: "nope" } } },
      },
      SENDER
    );

    expect(response.type).toBe(CLIENT_RESPONSE_TYPE.ERROR);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it("UPDATE_SCHEMAS answers ERROR when persistence fails", async () => {
    mocked(chrome.storage.local.set).mockRejectedValue(new Error("quota"));

    const response = await handleClientRequest(
      {
        type: CLIENT_REQUEST_TYPE.UPDATE_SCHEMAS,
        payload: { op: { op: SCHEMA_OP.DELETE, id: "a" } },
      },
      SENDER
    );

    expect(response).toEqual({
      type: CLIENT_RESPONSE_TYPE.ERROR,
      payload: { message: "quota" },
    });
  });
});
