import { describe, expect, it } from "vitest";
import { countToPrune, pruneEvents, pruneSlack } from "./prune";

describe("prune", () => {
  describe("pruneSlack", () => {
    it("is a fifth of the limit, capped at 100", () => {
      expect(pruneSlack(10)).toBe(2);
      expect(pruneSlack(500)).toBe(100);
      expect(pruneSlack(5000)).toBe(100);
    });

    it("is zero for tiny limits", () => {
      expect(pruneSlack(1)).toBe(0);
      expect(pruneSlack(4)).toBe(0);
    });
  });

  describe("countToPrune", () => {
    it("returns 0 while within the limit", () => {
      expect(countToPrune(0, 10)).toBe(0);
      expect(countToPrune(10, 10)).toBe(0);
    });

    it("drops down to limit minus slack once over the limit", () => {
      // limit 10, slack 2 -> keep 8
      expect(countToPrune(11, 10)).toBe(3);
      expect(countToPrune(25, 10)).toBe(17);
      // limit 500, slack 100 -> keep 400
      expect(countToPrune(501, 500)).toBe(101);
    });

    it("always keeps at least one event", () => {
      expect(countToPrune(5, 1)).toBe(4);
    });

    it("returns 0 for invalid limits", () => {
      expect(countToPrune(100, 0)).toBe(0);
      expect(countToPrune(100, -5)).toBe(0);
      expect(countToPrune(100, Number.NaN)).toBe(0);
      expect(countToPrune(100, Number.POSITIVE_INFINITY)).toBe(0);
    });
  });

  describe("pruneEvents", () => {
    const events = Array.from({ length: 12 }, (_, i) => ({ id: `e${i}` }));

    it("returns the same array untouched when within the limit", () => {
      const result = pruneEvents(events, 20);

      expect(result.kept).toBe(events);
      expect(result.removed).toEqual([]);
    });

    it("removes the oldest events first", () => {
      const result = pruneEvents(events, 10);

      // limit 10, slack 2 -> keep 8, drop 4 oldest
      expect(result.removed.map((e) => e.id)).toEqual(["e0", "e1", "e2", "e3"]);
      expect(result.kept.map((e) => e.id)).toEqual([
        "e4",
        "e5",
        "e6",
        "e7",
        "e8",
        "e9",
        "e10",
        "e11",
      ]);
    });

    it("does not mutate the input", () => {
      const copy = [...events];

      pruneEvents(events, 10);

      expect(events).toEqual(copy);
    });
  });
});
