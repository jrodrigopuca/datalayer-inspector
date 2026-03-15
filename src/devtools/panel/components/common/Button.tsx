/**
 * Button component
 */

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const BUTTON_VARIANT = {
  DEFAULT: "default",
  PRIMARY: "primary",
  GHOST: "ghost",
  DANGER: "danger",
} as const;

type ButtonVariant = (typeof BUTTON_VARIANT)[keyof typeof BUTTON_VARIANT];

const BUTTON_SIZE = {
  SM: "sm",
  MD: "md",
  LG: "lg",
  ICON: "icon",
} as const;

type ButtonSize = (typeof BUTTON_SIZE)[keyof typeof BUTTON_SIZE];

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  default:
    "bg-panel-surface hover:bg-panel-border text-gray-200 border border-panel-border",
  primary:
    "bg-brand-primary hover:bg-brand-primary/80 text-white border border-transparent",
  ghost: "hover:bg-panel-surface text-gray-300 border border-transparent",
  danger:
    "bg-event-error/20 hover:bg-event-error/30 text-event-error border border-event-error/30",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-6 px-2 text-xs",
  md: "h-8 px-3 text-sm",
  lg: "h-10 px-4 text-base",
  icon: "h-8 w-8 p-0",
};

function Button(
  { className, variant = "default", size = "md", disabled, ...props }: ButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
        "disabled:opacity-50 disabled:pointer-events-none",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled}
      {...props}
    />
  );
}

const ForwardedButton = forwardRef(Button);
ForwardedButton.displayName = "Button";

export { ForwardedButton as Button, BUTTON_VARIANT, BUTTON_SIZE };
export type { ButtonProps, ButtonVariant, ButtonSize };
