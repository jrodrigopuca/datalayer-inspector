/**
 * EventBadge component - visual indicator for event type
 *
 * Shows the actual event name (like in dataLayer), with color based on category
 */

import { Badge } from "../common";
import { EVENT_PATTERNS } from "@shared/constants";

interface EventBadgeProps {
  eventName: string | null;
}

/**
 * Determine event category from event name (used for coloring)
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

export function EventBadge({ eventName }: EventBadgeProps) {
  const category = getEventCategory(eventName);
  // Show actual event name, or "push" for events without event key
  const displayLabel = eventName ?? "push";

  return <Badge variant={category}>{displayLabel}</Badge>;
}

export { getEventCategory };
