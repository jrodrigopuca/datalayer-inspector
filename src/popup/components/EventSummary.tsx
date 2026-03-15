/**
 * EventSummary component - shows event count and last event
 */

import type { DataLayerEvent } from "@shared/types";
import { EVENT_PATTERNS } from "@shared/constants";

interface EventSummaryProps {
  events: readonly DataLayerEvent[];
}

export function EventSummary({ events }: EventSummaryProps) {
  const lastEvent = events.length > 0 ? events[events.length - 1] : null;

  // Count by category
  let gtmCount = 0;
  let ecommerceCount = 0;
  let customCount = 0;

  for (const event of events) {
    const eventName = event.eventName ?? "";
    if (EVENT_PATTERNS.GTM.test(eventName)) {
      gtmCount++;
    } else if (EVENT_PATTERNS.ECOMMERCE.test(eventName)) {
      ecommerceCount++;
    } else {
      customCount++;
    }
  }

  return (
    <div className="p-3">
      {/* Total count */}
      <div className="text-center mb-3">
        <div className="text-3xl font-bold text-gray-100">{events.length}</div>
        <div className="text-xs text-gray-500">events captured</div>
      </div>

      {/* Category breakdown */}
      <div className="flex justify-around text-xs mb-3">
        <div className="text-center">
          <div className="text-event-gtm font-medium">{gtmCount}</div>
          <div className="text-gray-500">GTM</div>
        </div>
        <div className="text-center">
          <div className="text-event-ecommerce font-medium">{ecommerceCount}</div>
          <div className="text-gray-500">Ecommerce</div>
        </div>
        <div className="text-center">
          <div className="text-event-custom font-medium">{customCount}</div>
          <div className="text-gray-500">Custom</div>
        </div>
      </div>

      {/* Last event */}
      {lastEvent && (
        <div className="border-t border-panel-border pt-2">
          <div className="text-2xs text-gray-500 mb-1">Last event</div>
          <div className="text-sm font-mono text-gray-200 truncate">
            {lastEvent.eventName ?? "(push)"}
          </div>
          <div className="text-2xs text-gray-500">
            {new Date(lastEvent.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
