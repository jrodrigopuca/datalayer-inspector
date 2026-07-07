/**
 * Interaction tracker tests
 *
 * Verifies push-to-interaction attribution and that element
 * descriptions never leak input values.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { TRIGGER_TYPE } from "../shared/types";
import {
  buildSelector,
  describeElement,
  resetTracker,
  resolveTrigger,
  startInteractionTracking,
} from "./interaction-tracker";

describe("interaction-tracker", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    resetTracker(Date.now());
    startInteractionTracking();
  });

  describe("describeElement", () => {
    it("uses visible text for buttons", () => {
      const button = document.createElement("button");
      button.textContent = "Add to cart";
      expect(describeElement(button)).toBe('button "Add to cart"');
    });

    it("prefers aria-label over text", () => {
      const button = document.createElement("button");
      button.setAttribute("aria-label", "Close dialog");
      button.textContent = "×";
      expect(describeElement(button)).toBe('button "Close dialog"');
    });

    it("never exposes input values", () => {
      const input = document.createElement("input");
      input.type = "email";
      input.value = "secret@example.com";
      input.placeholder = "Your email";

      const description = describeElement(input);
      expect(description).not.toContain("secret@example.com");
      expect(description).toBe('input "Your email"');
    });

    it("truncates long labels", () => {
      const button = document.createElement("button");
      button.textContent = "A".repeat(100);
      const description = describeElement(button);
      expect(description).toBeDefined();
      expect((description ?? "").length).toBeLessThan(60);
    });
  });

  describe("buildSelector", () => {
    it("prefers id", () => {
      const el = document.createElement("button");
      el.id = "add-to-cart";
      el.className = "btn primary";
      expect(buildSelector(el)).toBe("#add-to-cart");
    });

    it("falls back to data-testid, then tag with classes", () => {
      const withTestId = document.createElement("button");
      withTestId.setAttribute("data-testid", "buy-now");
      expect(buildSelector(withTestId)).toBe('[data-testid="buy-now"]');

      const withClasses = document.createElement("a");
      withClasses.className = "nav-link active extra ignored";
      expect(buildSelector(withClasses)).toBe("a.nav-link.active");
    });
  });

  describe("resolveTrigger", () => {
    it("attributes a push right after a click to that click", () => {
      const button = document.createElement("button");
      button.id = "add-to-cart";
      button.textContent = "Add to cart";
      document.body.appendChild(button);

      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      const trigger = resolveTrigger(Date.now());
      expect(trigger.type).toBe(TRIGGER_TYPE.CLICK);
      expect(trigger.label).toBe('button "Add to cart"');
      expect(trigger.selector).toBe("#add-to-cart");
      expect(trigger.sinceMs).toBeGreaterThanOrEqual(0);
    });

    it("attributes the click to the interactive ancestor of the target", () => {
      const button = document.createElement("button");
      button.id = "buy";
      const span = document.createElement("span");
      span.textContent = "Buy now";
      button.appendChild(span);
      document.body.appendChild(button);

      span.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      const trigger = resolveTrigger(Date.now());
      expect(trigger.type).toBe(TRIGGER_TYPE.CLICK);
      expect(trigger.selector).toBe("#buy");
    });

    it("falls back to page-load shortly after navigation", () => {
      const navStart = Date.now();
      resetTracker(navStart);

      const trigger = resolveTrigger(navStart + 500);
      expect(trigger.type).toBe(TRIGGER_TYPE.PAGE_LOAD);
      expect(trigger.sinceMs).toBe(500);
    });

    it("falls back to script when nothing recent happened", () => {
      const navStart = Date.now() - 60_000;
      resetTracker(navStart);

      const trigger = resolveTrigger(Date.now());
      expect(trigger.type).toBe(TRIGGER_TYPE.SCRIPT);
      expect(trigger.label).toBeNull();
    });

    it("does not attribute a push to an old interaction", () => {
      const navStart = Date.now() - 60_000;
      resetTracker(navStart);

      const button = document.createElement("button");
      document.body.appendChild(button);
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      // Push 10 seconds after the click - way past the window
      const trigger = resolveTrigger(Date.now() + 10_000);
      expect(trigger.type).toBe(TRIGGER_TYPE.SCRIPT);
    });
  });
});
