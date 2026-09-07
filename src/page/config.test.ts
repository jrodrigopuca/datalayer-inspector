import type { PageConfigPayload } from "@shared/types";
import { CONTENT_TO_PAGE_TYPE, MESSAGE_SOURCE } from "@shared/types";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import { listenForConfig } from "./config";

type Handler = (event: MessageEvent<unknown>) => void;

const VALID = {
  source: MESSAGE_SOURCE,
  type: CONTENT_TO_PAGE_TYPE.CONFIG,
  payload: {
    enabled: true,
    dataLayerNames: ["dataLayer", "customLayer"],
    relayId: "relay-1",
  },
};

function messageFromWindow(data: unknown): MessageEvent<unknown> {
  return { source: window, data } as unknown as MessageEvent<unknown>;
}

describe("listenForConfig", () => {
  let handler: Handler;
  let onConfig: Mock<(config: PageConfigPayload) => void>;
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(window, "addEventListener");
    onConfig = vi.fn<(config: PageConfigPayload) => void>();
    listenForConfig(onConfig);
    const call = spy.mock.calls.find((c: unknown[]) => c[0] === "message");
    handler = call?.[1] as unknown as Handler;
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it("delivers a valid config from this window", () => {
    handler(messageFromWindow(VALID));

    expect(onConfig).toHaveBeenCalledWith(VALID.payload);
  });

  it("ignores messages from other windows", () => {
    handler({ source: null, data: VALID } as unknown as MessageEvent<unknown>);

    expect(onConfig).not.toHaveBeenCalled();
  });

  it("ignores other Strata message types and foreign sources", () => {
    handler(messageFromWindow({ ...VALID, type: "DL_EVENT_CAPTURED" }));
    handler(messageFromWindow({ ...VALID, source: "someone-else" }));

    expect(onConfig).not.toHaveBeenCalled();
  });

  it("ignores malformed payloads", () => {
    handler(messageFromWindow({ ...VALID, payload: { enabled: "yes" } }));
    handler(
      messageFromWindow({
        ...VALID,
        payload: { enabled: true, dataLayerNames: ["ok", 42] },
      })
    );
    handler(messageFromWindow({ ...VALID, payload: null }));
    handler(
      messageFromWindow({
        ...VALID,
        payload: { enabled: true, dataLayerNames: ["dataLayer"] },
      })
    );

    expect(onConfig).not.toHaveBeenCalled();
  });

  it("survives a throwing callback", () => {
    onConfig.mockImplementation(() => {
      throw new Error("boom");
    });

    expect(() => handler(messageFromWindow(VALID))).not.toThrow();
  });
});
