/**
 * useFocusTrap hook - traps focus within a container and handles Escape key
 */

import { useEffect, useRef, type RefObject } from "react";

interface UseFocusTrapOptions {
  /** Whether the trap is active */
  isActive: boolean;
  /** Called when Escape is pressed */
  onEscape?: () => void;
  /** Selector for focusable elements (default: common interactive elements) */
  focusableSelector?: string;
}

const DEFAULT_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Hook that traps focus within a container element
 * @returns ref to attach to the container element
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>({
  isActive,
  onEscape,
  focusableSelector = DEFAULT_FOCUSABLE_SELECTOR,
}: UseFocusTrapOptions): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store the currently focused element to restore later
    previousActiveElement.current = document.activeElement;

    // Focus the first focusable element in the container
    const container = containerRef.current;
    if (container) {
      const focusableElements = container.querySelectorAll(focusableSelector);
      const firstElement = focusableElements[0] as HTMLElement | undefined;
      // Small delay to ensure the modal is rendered
      requestAnimationFrame(() => {
        firstElement?.focus();
      });
    }

    function handleKeyDown(e: KeyboardEvent): void {
      // Handle Escape
      if (e.key === "Escape" && onEscape) {
        e.preventDefault();
        e.stopPropagation();
        onEscape();
        return;
      }

      // Handle Tab for focus trap
      if (e.key === "Tab" && container) {
        const focusableElements = container.querySelectorAll(focusableSelector);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          // Shift+Tab: if on first element, go to last
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab: if on last element, go to first
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    // Prevent body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;

      // Restore focus to the previously focused element
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive, onEscape, focusableSelector]);

  return containerRef;
}
