/**
 * Badge component
 */

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const BADGE_VARIANT = {
  DEFAULT: "default",
  GTM: "gtm",
  ECOMMERCE: "ecommerce",
  CUSTOM: "custom",
  ERROR: "error",
} as const;

type BadgeVariant = (typeof BADGE_VARIANT)[keyof typeof BADGE_VARIANT];

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-panel-border text-gray-300",
  gtm: "bg-event-gtm/20 text-event-gtm",
  ecommerce: "bg-event-ecommerce/20 text-event-ecommerce",
  custom: "bg-event-custom/20 text-event-custom",
  error: "bg-event-error/20 text-event-error",
};

function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-medium",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge, BADGE_VARIANT };
export type { BadgeProps, BadgeVariant };
