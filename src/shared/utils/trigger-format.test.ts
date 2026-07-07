/**
 * Trigger formatter tests
 */

import { describe, expect, it } from "vitest";
import type { EventTrigger } from "../types";
import { TRIGGER_TYPE } from "../types";
import {
  formatTriggerFull,
  formatTriggerShort,
  isUserInteractionTrigger,
} from "./trigger-format";

function makeTrigger(overrides: Partial<EventTrigger> = {}): EventTrigger {
  return {
    type: TRIGGER_TYPE.CLICK,
    label: 'button "Add to cart"',
    selector: "#add-to-cart",
    sinceMs: 130,
    ...overrides,
  };
}

describe("isUserInteractionTrigger", () => {
  it("is true for interactions, false for load/script", () => {
    expect(isUserInteractionTrigger(makeTrigger())).toBe(true);
    expect(
      isUserInteractionTrigger(makeTrigger({ type: TRIGGER_TYPE.SUBMIT }))
    ).toBe(true);
    expect(
      isUserInteractionTrigger(makeTrigger({ type: TRIGGER_TYPE.PAGE_LOAD }))
    ).toBe(false);
    expect(
      isUserInteractionTrigger(makeTrigger({ type: TRIGGER_TYPE.SCRIPT }))
    ).toBe(false);
  });
});

describe("formatTriggerShort", () => {
  it("surfaces just the quoted human label", () => {
    expect(formatTriggerShort(makeTrigger())).toBe("Add to cart");
  });

  it("falls back to the raw label, then the type", () => {
    expect(formatTriggerShort(makeTrigger({ label: "button" }))).toBe("button");
    expect(formatTriggerShort(makeTrigger({ label: null }))).toBe("Click");
  });
});

describe("formatTriggerFull", () => {
  it("describes a click with target, selector and timing", () => {
    expect(formatTriggerFull(makeTrigger())).toBe(
      'Click on button "Add to cart" (#add-to-cart, +130ms)'
    );
  });

  it("describes page-load with elapsed time", () => {
    const trigger = makeTrigger({
      type: TRIGGER_TYPE.PAGE_LOAD,
      label: null,
      selector: null,
      sinceMs: 800,
    });
    expect(formatTriggerFull(trigger)).toBe(
      "Page load (+800ms after navigation)"
    );
  });

  it("describes script pushes honestly", () => {
    const trigger = makeTrigger({
      type: TRIGGER_TYPE.SCRIPT,
      label: null,
      selector: null,
      sinceMs: null,
    });
    expect(formatTriggerFull(trigger)).toBe(
      "Script (no recent user interaction)"
    );
  });

  it("stays ASCII-only for PDF compatibility", () => {
    for (const trigger of [
      makeTrigger(),
      makeTrigger({ type: TRIGGER_TYPE.PAGE_LOAD }),
      makeTrigger({ type: TRIGGER_TYPE.SCRIPT }),
    ]) {
      // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ASCII range check
      expect(formatTriggerFull(trigger)).toMatch(/^[\x20-\x7E]*$/);
    }
  });
});
