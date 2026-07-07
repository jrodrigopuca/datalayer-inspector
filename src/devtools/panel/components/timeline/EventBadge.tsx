/**
 * EventBadge component - compact category indicator
 *
 * Shows a short category label; the event name itself is rendered by
 * the row (EventItem), so the badge never competes with it for space.
 */

import type { EventCategory } from "@shared/utils";
import { getEventCategory } from "@shared/utils";
import { Badge } from "../common";

interface EventBadgeProps {
  eventName: string | null;
}

const CATEGORY_LABEL: Record<EventCategory, string> = {
  gtm: "GTM",
  ecommerce: "Ecom",
  engagement: "Engage",
  error: "Error",
  custom: "Custom",
};

export function EventBadge({ eventName }: EventBadgeProps) {
  const category = getEventCategory(eventName);

  return (
    <Badge variant={category} className="flex-shrink-0">
      {CATEGORY_LABEL[category]}
    </Badge>
  );
}
