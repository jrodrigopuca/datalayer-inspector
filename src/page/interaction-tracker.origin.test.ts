/**
 * Navigation start comes from the document, not from when the script ran
 * (docs/TECH-DEBT.md, item 5).
 */

import { TRIGGER_TYPE } from "@shared/types";
import { describe, expect, it } from "vitest";
import { resetTracker, resolveTrigger } from "./interaction-tracker";

describe("interaction-tracker navigation start", () => {
  it("defaults to performance.timeOrigin", () => {
    resetTracker();
    const origin = performance.timeOrigin;

    const trigger = resolveTrigger(origin + 250);

    expect(trigger.type).toBe(TRIGGER_TYPE.PAGE_LOAD);
    expect(trigger.sinceMs).toBe(250);
  });

  it("treats pushes long after navigation as script-driven", () => {
    resetTracker();

    const trigger = resolveTrigger(performance.timeOrigin + 60_000);

    expect(trigger.type).toBe(TRIGGER_TYPE.SCRIPT);
  });
});
