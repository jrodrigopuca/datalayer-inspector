/**
 * Page Script - Interaction Tracker
 *
 * Records the most recent user interaction so pushes can be attributed
 * to what caused them ("click on 'Add to cart'"). Same heuristic GTM
 * triggers use: a push shortly after an interaction belongs to it.
 *
 * PRIVACY: never captures input values or typed text - only element
 * descriptions (tag, id, visible label).
 *
 * CRITICAL: runs in page context - listeners are passive and errors
 * must never break the page.
 */

import type { EventTrigger, TriggerType } from "@shared/types";
import { TRIGGER_TYPE } from "@shared/types";

/** A push within this window after an interaction is attributed to it */
const ATTRIBUTION_WINDOW_MS = 2000;

/** Pushes within this window after navigation count as page-load */
const PAGE_LOAD_WINDOW_MS = 3000;

const MAX_LABEL_LENGTH = 40;

interface LastInteraction {
  type: TriggerType;
  label: string | null;
  selector: string | null;
  timestamp: number;
}

interface TrackerState {
  lastInteraction: LastInteraction | null;
  navigationStart: number;
}

const state: TrackerState = {
  lastInteraction: null,
  navigationStart: Date.now(),
};

/**
 * Reset state (for testing)
 */
export function resetTracker(navigationStart: number = Date.now()): void {
  state.lastInteraction = null;
  state.navigationStart = navigationStart;
}

/**
 * Find the interactive element a click actually targets
 * (the click target is often a <span> inside the real <button>)
 */
function findInteractiveTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;

  return (
    target.closest(
      'button, a, [role="button"], [role="link"], [role="tab"], input, select, textarea, label, summary'
    ) ?? target
  );
}

/**
 * Human-readable description of an element: 'button "Add to cart"'.
 * Never reads input values.
 */
export function describeElement(element: Element): string | null {
  try {
    const tag = element.tagName.toLowerCase();

    // Prefer explicit accessible names, then visible text
    const ariaLabel = element.getAttribute("aria-label");
    const title = element.getAttribute("title");
    const alt = element.getAttribute("alt");

    let text = ariaLabel ?? title ?? alt;

    if (!text && tag !== "input" && tag !== "textarea" && tag !== "select") {
      text = element.textContent?.trim() ?? null;
    }

    // Inputs: describe by type/name/placeholder, NEVER by value
    if (!text && element instanceof HTMLInputElement) {
      text =
        element.placeholder ||
        element.name ||
        (element.type ? `type=${element.type}` : null);
    }

    if (text) {
      const clean = text.replace(/\s+/g, " ").trim();
      const truncated =
        clean.length > MAX_LABEL_LENGTH
          ? `${clean.slice(0, MAX_LABEL_LENGTH - 1)}…`
          : clean;
      return `${tag} "${truncated}"`;
    }

    return tag;
  } catch {
    return null;
  }
}

/**
 * Compact selector for an element: #id, [data-testid], or tag.classes
 */
export function buildSelector(element: Element): string | null {
  try {
    if (element.id) {
      return `#${element.id}`;
    }

    const testId = element.getAttribute("data-testid");
    if (testId) {
      return `[data-testid="${testId}"]`;
    }

    const tag = element.tagName.toLowerCase();
    const classes = [...element.classList].slice(0, 2);
    return classes.length > 0 ? `${tag}.${classes.join(".")}` : tag;
  } catch {
    return null;
  }
}

function recordInteraction(
  type: TriggerType,
  target: EventTarget | null
): void {
  try {
    const element = findInteractiveTarget(target);
    state.lastInteraction = {
      type,
      label: element ? describeElement(element) : null,
      selector: element ? buildSelector(element) : null,
      timestamp: Date.now(),
    };
  } catch {
    // Silent fail - must not break page
  }
}

/**
 * Start listening for user interactions.
 * Capture phase so stopPropagation() in page code can't hide them.
 */
export function startInteractionTracking(): void {
  try {
    window.addEventListener(
      "click",
      (e) => recordInteraction(TRIGGER_TYPE.CLICK, e.target),
      { capture: true, passive: true }
    );

    window.addEventListener(
      "submit",
      (e) => recordInteraction(TRIGGER_TYPE.SUBMIT, e.target),
      { capture: true, passive: true }
    );

    window.addEventListener(
      "change",
      (e) => recordInteraction(TRIGGER_TYPE.CHANGE, e.target),
      { capture: true, passive: true }
    );

    // Only Enter: it triggers actions; typed text is never recorded
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter") {
          recordInteraction(TRIGGER_TYPE.KEYBOARD, e.target);
        }
      },
      { capture: true, passive: true }
    );
  } catch {
    // Silent fail
  }
}

/**
 * Attribute a push happening at `timestamp` to its most likely cause
 */
export function resolveTrigger(timestamp: number): EventTrigger {
  const interaction = state.lastInteraction;

  if (interaction) {
    const elapsed = timestamp - interaction.timestamp;
    if (elapsed >= 0 && elapsed <= ATTRIBUTION_WINDOW_MS) {
      return {
        type: interaction.type,
        label: interaction.label,
        selector: interaction.selector,
        sinceMs: elapsed,
      };
    }
  }

  const sinceNavigation = timestamp - state.navigationStart;
  if (sinceNavigation >= 0 && sinceNavigation <= PAGE_LOAD_WINDOW_MS) {
    return {
      type: TRIGGER_TYPE.PAGE_LOAD,
      label: null,
      selector: null,
      sinceMs: sinceNavigation,
    };
  }

  return {
    type: TRIGGER_TYPE.SCRIPT,
    label: null,
    selector: null,
    sinceMs: null,
  };
}
