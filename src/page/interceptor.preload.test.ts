/**
 * Events already in the array when Strata attaches are reported in order
 * but marked "preload": their timing is unknown (docs/TECH-DEBT.md, item 5).
 */

import { TRIGGER_TYPE } from "@shared/types";
import { beforeEach, describe, expect, it } from "vitest";
import { resetTracker } from "./interaction-tracker";
import { interceptDataLayer, replayExisting, resetState } from "./interceptor";
import type { CapturedEventData } from "./message-emitter";

describe("interceptor preload attribution", () => {
  let captured: CapturedEventData[];

  beforeEach(() => {
    resetState();
    resetTracker(Date.now());
    captured = [];
    delete (window as unknown as Record<string, unknown>).dataLayer;
  });

  it("marks pre-existing events as preload and live pushes normally", () => {
    const win = window as unknown as { dataLayer: unknown[] };
    win.dataLayer = [{ event: "gtm.js" }, { event: "page_view" }];

    const existing = interceptDataLayer("dataLayer", (e) => captured.push(e));
    win.dataLayer.push({ event: "add_to_cart" });

    expect(existing).toBe(2);
    expect(captured.map((e) => e.eventName)).toEqual([
      "gtm.js",
      "page_view",
      "add_to_cart",
    ]);
    expect(captured[0]?.trigger).toEqual({
      type: TRIGGER_TYPE.PRELOAD,
      label: null,
      selector: null,
      sinceMs: null,
    });
    expect(captured[1]?.trigger?.type).toBe(TRIGGER_TYPE.PRELOAD);
    // A push right after navigation is page-load, never preload
    expect(captured[2]?.trigger?.type).toBe(TRIGGER_TYPE.PAGE_LOAD);
  });

  it("replays the array as preload events when capture is turned on later", () => {
    const win = window as unknown as { dataLayer: unknown[] };
    win.dataLayer = [{ event: "gtm.js" }];
    interceptDataLayer("dataLayer", () => undefined); // captured while OFF: dropped
    win.dataLayer.push({ event: "page_view" });

    const replayed = replayExisting("dataLayer", (e) => captured.push(e));

    expect(replayed).toBe(2);
    expect(captured.map((e) => e.eventName)).toEqual(["gtm.js", "page_view"]);
    expect(
      captured.every((e) => e.trigger?.type === TRIGGER_TYPE.PRELOAD)
    ).toBe(true);
  });

  it("replay is a no-op for a missing or non-array global", () => {
    expect(replayExisting("nope", (e) => captured.push(e))).toBe(0);
    (window as unknown as Record<string, unknown>).notArray = 42;
    expect(replayExisting("notArray", (e) => captured.push(e))).toBe(0);
    expect(captured).toHaveLength(0);
  });

  it("keeps the original order of pre-existing events", () => {
    const win = window as unknown as { dataLayer: unknown[] };
    win.dataLayer = [{ event: "a" }, { event: "b" }, { event: "c" }];

    interceptDataLayer("dataLayer", (e) => captured.push(e));

    expect(captured.map((e) => e.index)).toEqual([1, 2, 3]);
  });
});
