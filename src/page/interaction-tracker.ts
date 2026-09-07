/**
 * Page Script - Interaction Tracker
 *
 * Records the most recent user interaction so pushes can be attributed
 * to what caused them ("click on 'Add to cart'"). Same heuristic GTM
 * triggers use: a push shortly after an interaction belongs to it.
 *
 * PRIVACY (docs/TECH-DEBT.md, item 6): the description of an element may
 * contain text ONLY when that text exists to be read as a control label:
 * - an explicit accessible name (aria-label, title, alt),
 * - the <label> associated with a form control,
 * - the visible text of a control (button, link, tab, summary, label).
 * Anything else (table cells, divs, spans, forms) is described by tag and
 * selector alone, because its content may be personal data. Input values
 * are never read, except the caption of input[type=submit|button|reset].
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

/**
 * When the document actually started loading. Independent of when THIS
 * script ran, so attribution stays right even if we attach late.
 */
function documentNavigationStart(): number {
  try {
    const origin = performance.timeOrigin;
    if (Number.isFinite(origin) && origin > 0) return origin;
  } catch {
    // performance may be unavailable in exotic contexts
  }
  return Date.now();
}

const state: TrackerState = {
  lastInteraction: null,
  navigationStart: documentNavigationStart(),
};

/**
 * Reset state (for testing)
 */
export function resetTracker(
  navigationStart: number = documentNavigationStart()
): void {
  state.lastInteraction = null;
  state.navigationStart = navigationStart;
}

/** Elements a click is attributed to (walks up from the raw target) */
const INTERACTIVE_SELECTOR =
  'button, a, [role="button"], [role="link"], [role="tab"], input, select, textarea, label, summary';

/** Elements whose visible text IS their label and is safe to record */
const TEXT_BEARING_SELECTOR =
  'button, a, [role="button"], [role="link"], [role="tab"], summary, label';

/** input types whose `value` is a caption, not user data */
const CAPTION_INPUT_TYPES = new Set(["submit", "button", "reset"]);

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isFormControl(element: Element): element is FormControl {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
}

/**
 * Find the interactive element a click actually targets
 * (the click target is often a <span> inside the real <button>)
 */
function findInteractiveTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;

  return target.closest(INTERACTIVE_SELECTOR) ?? target;
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Text of a <label>, excluding any form control nested inside it
 * (<label>Plan <select>…</select></label> must read "Plan", not the options)
 */
function labelOwnText(label: HTMLLabelElement): string | null {
  const parts: string[] = [];
  for (const node of label.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? "");
    } else if (node instanceof Element && !isFormControl(node)) {
      parts.push(node.textContent ?? "");
    }
  }
  return nonEmpty(parts.join(" "));
}

/**
 * Describe a form control by its label, placeholder or name. NEVER its value.
 */
function describeFormControl(control: FormControl): string | null {
  const firstLabel = control.labels?.[0];
  if (firstLabel) {
    const text = labelOwnText(firstLabel);
    if (text) return text;
  }

  if (control instanceof HTMLInputElement) {
    if (CAPTION_INPUT_TYPES.has(control.type)) {
      return nonEmpty(control.value);
    }
    return (
      nonEmpty(control.placeholder) ??
      nonEmpty(control.name) ??
      (control.type ? `type=${control.type}` : null)
    );
  }

  return nonEmpty(control.getAttribute("name"));
}

/**
 * Human-readable description of an element: 'button "Add to cart"'.
 * See the PRIVACY note at the top of this file for what text is allowed.
 */
export function describeElement(element: Element): string | null {
  try {
    const tag = element.tagName.toLowerCase();

    // 1) Explicit accessible name: authored for humans, safe anywhere
    let text =
      nonEmpty(element.getAttribute("aria-label")) ??
      nonEmpty(element.getAttribute("title")) ??
      nonEmpty(element.getAttribute("alt"));

    // 2) Form controls: their <label>, never their content
    if (!text && isFormControl(element)) {
      text = describeFormControl(element);
    }

    // 3) Controls whose visible text is their label
    if (!text && !isFormControl(element)) {
      if (element instanceof HTMLLabelElement) {
        text = labelOwnText(element);
      } else if (element.matches(TEXT_BEARING_SELECTOR)) {
        text = nonEmpty(element.textContent);
      }
    }

    // 4) Forms: identifier only (their content is the user's data)
    if (!text && element instanceof HTMLFormElement) {
      text = nonEmpty(element.getAttribute("name")) ?? nonEmpty(element.id);
    }

    // 5) Anything else (td, div, span...): tag only
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
