import { describe, expect, it } from "vitest";
import { claimRelaySlot } from "./guard";

describe("claimRelaySlot", () => {
  it("lets the first execution start and blocks the second", () => {
    const scope: Record<string, unknown> = {};

    expect(claimRelaySlot(scope)).toBe(true);
    expect(claimRelaySlot(scope)).toBe(false);
    expect(claimRelaySlot(scope)).toBe(false);
  });

  it("is independent per isolated world", () => {
    expect(claimRelaySlot({})).toBe(true);
    expect(claimRelaySlot({})).toBe(true);
  });
});
