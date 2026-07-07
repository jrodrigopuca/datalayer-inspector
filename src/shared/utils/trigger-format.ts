/**
 * Trigger formatting helpers - render EventTrigger for humans
 *
 * Shared between the panel UI and the evidence generators.
 * PDF-safe: formatTriggerFull uses ASCII only (jsPDF standard fonts
 * are Latin-1 and won't render arrows or other symbols).
 */

import type { EventTrigger, TriggerType } from "../types";
import { TRIGGER_TYPE } from "../types";

const USER_TRIGGER_TYPES: readonly TriggerType[] = [
  TRIGGER_TYPE.CLICK,
  TRIGGER_TYPE.SUBMIT,
  TRIGGER_TYPE.CHANGE,
  TRIGGER_TYPE.KEYBOARD,
];

/** True when the trigger is a real user interaction (not load/script) */
export function isUserInteractionTrigger(trigger: EventTrigger): boolean {
  return USER_TRIGGER_TYPES.includes(trigger.type);
}

const TYPE_LABEL: Record<TriggerType, string> = {
  click: "Click",
  submit: "Form submit",
  change: "Field change",
  keyboard: "Enter key",
  "page-load": "Page load",
  script: "Script",
};

/**
 * Minimal one-liner for the timeline row: the human label if we have
 * one ('Add to cart'), otherwise the interaction type ('Click').
 */
export function formatTriggerShort(trigger: EventTrigger): string {
  if (trigger.label) {
    // label looks like 'button "Add to cart"' - surface just the quoted text
    const quoted = trigger.label.match(/"([^"]+)"/);
    if (quoted?.[1]) {
      return quoted[1];
    }
    return trigger.label;
  }
  return TYPE_LABEL[trigger.type];
}

/**
 * Full description for the detail view and evidence documents:
 * 'Click on button "Add to cart" (#add-to-cart, +130ms)'
 */
export function formatTriggerFull(trigger: EventTrigger): string {
  if (trigger.type === TRIGGER_TYPE.PAGE_LOAD) {
    return trigger.sinceMs !== null
      ? `Page load (+${trigger.sinceMs}ms after navigation)`
      : "Page load";
  }

  if (trigger.type === TRIGGER_TYPE.SCRIPT) {
    return "Script (no recent user interaction)";
  }

  const parts: string[] = [TYPE_LABEL[trigger.type]];
  if (trigger.label) {
    parts.push(`on ${trigger.label}`);
  }

  const details: string[] = [];
  if (trigger.selector) details.push(trigger.selector);
  if (trigger.sinceMs !== null) details.push(`+${trigger.sinceMs}ms`);

  return details.length > 0
    ? `${parts.join(" ")} (${details.join(", ")})`
    : parts.join(" ");
}
