/**
 * ConfirmDialog component - modal for confirming destructive actions
 */

import { useEffect, useRef } from "react";
import { Button } from "./Button";
import { WarningIcon, InfoIcon } from "./Icons";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Title of the dialog */
  title: string;
  /** Description/message */
  message: string;
  /** Text for confirm button */
  confirmText?: string;
  /** Text for cancel button */
  cancelText?: string;
  /** Variant for confirm button */
  variant?: "danger" | "primary";
  /** Called when user confirms */
  onConfirm: () => void;
  /** Called when user cancels or presses Escape */
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    // Focus the cancel button by default (safer option)
    cancelButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }

      // Focus trap
      if (e.key === "Tab") {
        const focusableElements = dialogRef.current?.querySelectorAll(
          'button:not([disabled])'
        );
        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  // Prevent body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-message"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className={cn(
          "relative bg-panel-bg border border-panel-border rounded-lg shadow-xl",
          "w-[400px] max-w-[90vw] p-4"
        )}
      >
        {/* Icon */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center",
              variant === "danger" ? "bg-red-500/20" : "bg-brand-primary/20"
            )}
          >
            {variant === "danger" ? (
              <WarningIcon className="w-5 h-5 text-red-400" />
            ) : (
              <InfoIcon className="w-5 h-5 text-brand-primary" />
            )}
          </div>
          <h2
            id="confirm-dialog-title"
            className="text-sm font-medium text-gray-100"
          >
            {title}
          </h2>
        </div>

        {/* Message */}
        <p
          id="confirm-dialog-message"
          className="text-sm text-gray-400 mb-4 pl-13"
        >
          {message}
        </p>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button
            ref={cancelButtonRef}
            size="sm"
            variant="ghost"
            onClick={onCancel}
          >
            {cancelText}
          </Button>
          <Button
            ref={confirmButtonRef}
            size="sm"
            variant={variant}
            onClick={onConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
