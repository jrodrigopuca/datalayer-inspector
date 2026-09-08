/**
 * Page-script integration: the whole entry point against a fake page.
 * Guards the ORDER of the handshake steps, which the pure planHandshake
 * cannot see (docs/TECH-DEBT.md, item 18 verification).
 */

import {
  CONTENT_TO_PAGE_TYPE,
  MESSAGE_SOURCE,
  PAGE_MESSAGE_TYPE,
} from "@shared/types";
import { beforeAll, describe, expect, it, vi } from "vitest";

type Handler = (event: MessageEvent<unknown>) => void;

const posted: Array<{ type: string; payload: Record<string, unknown> }> = [];
let configHandler: Handler;

function sendConfig(enabled: boolean, relayId = "relay-1"): void {
  configHandler({
    source: window,
    data: {
      source: MESSAGE_SOURCE,
      type: CONTENT_TO_PAGE_TYPE.CONFIG,
      payload: { enabled, dataLayerNames: ["dataLayer"], relayId },
    },
  } as unknown as MessageEvent<unknown>);
}

function types(): string[] {
  return posted.map((m) => m.type);
}

beforeAll(async () => {
  const win = window as unknown as Record<string, unknown>;
  win.dataLayer = [{ event: "gtm.js" }, { event: "page_view" }];
  win.google_tag_manager = {
    "GTM-SMOKE1": { dataLayer: { name: "dataLayer" } },
  };

  vi.spyOn(window, "postMessage").mockImplementation((message: unknown) => {
    posted.push(message as { type: string; payload: Record<string, unknown> });
  });
  const addListener = vi.spyOn(window, "addEventListener");

  await import("./index");

  const call = addListener.mock.calls.find(
    (c: unknown[]) => c[0] === "message"
  );
  configHandler = call?.[1] as unknown as Handler;
});

describe("page script entry point", () => {
  it("buffers everything until the handshake and drops it when capture is off", () => {
    expect(posted).toHaveLength(0);

    sendConfig(false);

    expect(posted).toHaveLength(0);
  });

  it("on the off -> on transition re-announces containers and replays the history", () => {
    sendConfig(true);

    expect(types()).toEqual([
      PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED,
      PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
      PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
    ]);
    expect(posted[0]?.payload).toEqual({
      containers: [{ id: "GTM-SMOKE1", dataLayerName: "dataLayer" }],
    });
    expect(
      posted
        .slice(1)
        .map((m) => (m.payload as { trigger: { type: string } }).trigger.type)
    ).toEqual(["preload", "preload"]);
  });

  it("captures live pushes once on", () => {
    posted.length = 0;

    (window as unknown as { dataLayer: unknown[] }).dataLayer.push({
      event: "add_to_cart",
    });

    expect(types()).toEqual([PAGE_MESSAGE_TYPE.EVENT_CAPTURED]);
    expect(posted[0]?.payload.eventName).toBe("add_to_cart");
  });

  it("toggling off and on again replays only what was pushed while off", () => {
    posted.length = 0;
    sendConfig(false);
    (window as unknown as { dataLayer: unknown[] }).dataLayer.push({
      event: "while_off",
    });
    expect(posted).toHaveLength(0);

    sendConfig(true);

    expect(types()).toEqual([
      PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED,
      PAGE_MESSAGE_TYPE.EVENT_CAPTURED,
    ]);
    expect(posted[1]?.payload.eventName).toBe("while_off");
    expect(
      (posted[1]?.payload as { trigger: { type: string } }).trigger.type
    ).toBe("preload");
  });

  it("a fresh relay gets containers and the whole history again", () => {
    posted.length = 0;

    sendConfig(true, "relay-2");

    expect(types()[0]).toBe(PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED);
    // gtm.js, page_view, add_to_cart, while_off: the whole array
    expect(
      types().filter((t) => t === PAGE_MESSAGE_TYPE.EVENT_CAPTURED)
    ).toHaveLength(4);
  });
});
