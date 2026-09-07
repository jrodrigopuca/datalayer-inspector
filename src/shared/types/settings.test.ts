import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./settings";

describe("DEFAULT_SETTINGS", () => {
  it("starts with capture OFF (product decision, docs/TECH-DEBT.md item 18)", () => {
    expect(DEFAULT_SETTINGS.enabled).toBe(false);
  });
});
