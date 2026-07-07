/**
 * Event categorization - single source of truth
 *
 * Used by the timeline badges, filters, counters and legend so they
 * never disagree about what category an event belongs to.
 */

import { EVENT_PATTERNS } from "../constants";

export const EVENT_CATEGORY = {
  GTM: "gtm",
  ECOMMERCE: "ecommerce",
  ENGAGEMENT: "engagement",
  ERROR: "error",
  CUSTOM: "custom",
} as const;

export type EventCategory =
  (typeof EVENT_CATEGORY)[keyof typeof EVENT_CATEGORY];

/**
 * Categorize an event by its name.
 *
 * Precedence: GTM internals → GA4 ecommerce → GA4 engagement →
 * error-looking names → custom.
 */
export function getEventCategory(eventName: string | null): EventCategory {
  if (!eventName) return EVENT_CATEGORY.CUSTOM;

  if (EVENT_PATTERNS.GTM.test(eventName)) return EVENT_CATEGORY.GTM;
  if (EVENT_PATTERNS.ECOMMERCE.test(eventName)) return EVENT_CATEGORY.ECOMMERCE;
  if (EVENT_PATTERNS.ENGAGEMENT.test(eventName)) {
    return EVENT_CATEGORY.ENGAGEMENT;
  }
  if (eventName.toLowerCase().includes("error")) return EVENT_CATEGORY.ERROR;

  return EVENT_CATEGORY.CUSTOM;
}
