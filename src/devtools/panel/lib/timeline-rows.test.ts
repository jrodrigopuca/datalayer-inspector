import type { DataLayerEvent } from "@shared/types";
import { describe, expect, it } from "vitest";
import { buildTimelineRows, computeDeltas } from "./timeline-rows";

function ev(i: number, path: string, documentId?: string): DataLayerEvent {
  return {
    id: `evt-${i}`,
    timestamp: 1000 + i * 10,
    url: `https://shop.example${path}`,
    eventName: "custom",
    data: {},
    containerIds: [],
    source: "dataLayer",
    index: i,
    ...(documentId && { documentId }),
  };
}

describe("buildTimelineRows", () => {
  it("marks a reload: same path, new document", () => {
    const events = [
      ev(1, "/cart", "doc-a"),
      ev(2, "/cart", "doc-a"),
      ev(3, "/cart", "doc-b"),
    ];

    const rows = buildTimelineRows(events, computeDeltas(events));

    expect(rows.map((r) => r.separator)).toEqual([
      null,
      null,
      { kind: "reload", path: "/cart" },
    ]);
  });

  it("marks a navigation when the path changes, even with a new document", () => {
    const events = [ev(1, "/cart", "doc-a"), ev(2, "/checkout", "doc-b")];

    const rows = buildTimelineRows(events, computeDeltas(events));

    expect(rows[1]?.separator).toEqual({ kind: "page", path: "/checkout" });
  });

  it("adds no separator for a bfcache restore (same document, same path)", () => {
    const events = [
      ev(1, "/a", "doc-a"),
      ev(2, "/b", "doc-b"),
      ev(3, "/a", "doc-a"),
    ];

    const rows = buildTimelineRows(events, computeDeltas(events));

    // Back to /a is a path change (page separator), not a reload
    expect(rows[2]?.separator).toEqual({ kind: "page", path: "/a" });
  });

  it("never marks a reload when documentId is unknown (older events)", () => {
    const events = [ev(1, "/cart"), ev(2, "/cart"), ev(3, "/cart", "doc-b")];

    const rows = buildTimelineRows(events, computeDeltas(events));

    expect(rows.every((r) => r.separator === null)).toBe(true);
  });

  it("carries deltas from the full stream", () => {
    const events = [ev(1, "/cart", "d"), ev(2, "/cart", "d")];

    const rows = buildTimelineRows(events, computeDeltas(events));

    expect(rows[0]?.deltaMs).toBeNull();
    expect(rows[1]?.deltaMs).toBe(10);
  });
});
