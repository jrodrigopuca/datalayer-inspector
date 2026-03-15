/**
 * EventBadge component - visual indicator for event type
 */

import { Badge } from "../common";
import { EVENT_PATTERNS } from "@shared/constants";

interface EventBadgeProps {
  eventName: string | null;
}

/**
 * Determine event category from event name
 */
function getEventCategory(
  eventName: string | null
): "gtm" | "ecommerce" | "custom" | "error" {
  if (!eventName) return "custom";

  if (EVENT_PATTERNS.GTM.test(eventName)) return "gtm";
  if (EVENT_PATTERNS.ECOMMERCE.test(eventName)) return "ecommerce";
  if (eventName.toLowerCase().includes("error")) return "error";

  return "custom";
}

const categoryLabels: Record<string, string> = {
  gtm: "GTM",
  ecommerce: "Ecom",
  custom: "Custom",
  error: "Error",
};

export function EventBadge({ eventName }: EventBadgeProps) {
  const category = getEventCategory(eventName);

  return <Badge variant={category}>{categoryLabels[category]}</Badge>;
}

export { getEventCategory };
