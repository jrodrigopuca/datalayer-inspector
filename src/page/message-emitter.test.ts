import { MESSAGE_SOURCE, PAGE_MESSAGE_TYPE } from "@shared/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CapturedEventData,
  configureEmitter,
  emitContainers,
  emitEvent,
  emitInitialized,
  getBufferedCount,
  resetEmitter,
} from "./message-emitter";

function event(i: number): CapturedEventData {
  return {
    id: `evt-${i}`,
    timestamp: 1000 + i,
    url: "https://shop.example/",
    eventName: `event_${i}`,
    data: { i },
    containerIds: [],
    sourceName: "dataLayer",
    index: i,
  };
}

describe("message-emitter", () => {
  let postMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetEmitter();
    postMessage = vi
      .spyOn(window, "postMessage")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    postMessage.mockRestore();
  });

  it("buffers everything until the handshake, then flushes in order", () => {
    emitContainers([{ id: "GTM-AAA111", dataLayerName: "dataLayer" }]);
    emitEvent(event(1));
    emitEvent(event(2));
    emitInitialized(["dataLayer"], 2);

    expect(postMessage).not.toHaveBeenCalled();
    expect(getBufferedCount()).toBe(4);

    configureEmitter({ enabled: true });

    expect(getBufferedCount()).toBe(0);
    const types = postMessage.mock.calls.map(
      (call: unknown[]) => (call[0] as { type: string }).type
    );
    expect(types).toEqual([
      PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED,
      PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
      PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
      PAGE_MESSAGE_TYPE.INITIALIZED,
    ]);
    const ids = postMessage.mock.calls
      .map(
        (call: unknown[]) =>
          (call[0] as { payload: { id?: string } }).payload.id
      )
      .filter(Boolean);
    expect(ids).toEqual(["evt-1", "evt-2"]);
  });

  it("emits directly once ready", () => {
    configureEmitter({ enabled: true });

    emitEvent(event(1));

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(
      {
        source: MESSAGE_SOURCE,
        type: PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
        payload: event(1),
      },
      "*"
    );
    expect(getBufferedCount()).toBe(0);
  });

  it("drops the buffer and stays silent when the extension is disabled", () => {
    emitEvent(event(1));
    emitEvent(event(2));

    configureEmitter({ enabled: false });
    emitEvent(event(3));

    expect(postMessage).not.toHaveBeenCalled();
    expect(getBufferedCount()).toBe(0);
  });

  it("resumes emitting when re-enabled later", () => {
    configureEmitter({ enabled: false });
    emitEvent(event(1));
    configureEmitter({ enabled: true });
    emitEvent(event(2));

    const ids = postMessage.mock.calls.map(
      (call: unknown[]) => (call[0] as { payload: { id: string } }).payload.id
    );
    expect(ids).toEqual(["evt-2"]);
  });

  it("caps the buffer, keeping the newest messages", () => {
    for (let i = 1; i <= 600; i++) emitEvent(event(i));

    expect(getBufferedCount()).toBe(500);

    configureEmitter({ enabled: true });

    const first = postMessage.mock.calls[0]?.[0] as {
      payload: { id: string };
    };
    const last = postMessage.mock.calls.at(-1)?.[0] as {
      payload: { id: string };
    };
    expect(first.payload.id).toBe("evt-101");
    expect(last.payload.id).toBe("evt-600");
  });

  it("never throws when postMessage fails", () => {
    postMessage.mockImplementation(() => {
      throw new Error("blocked");
    });
    configureEmitter({ enabled: true });

    expect(() => emitEvent(event(1))).not.toThrow();
  });
});
