/**
 * SplitPane component - resizable split view
 */

import { useState, useRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
}

export function SplitPane({
  left,
  right,
  defaultLeftWidth = 300,
  minLeftWidth = 200,
  maxLeftWidth = 500,
}: SplitPaneProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent): void {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const clampedWidth = Math.min(
        Math.max(newWidth, minLeftWidth),
        maxLeftWidth
      );
      setLeftWidth(clampedWidth);
    }

    function handleMouseUp(): void {
      setIsDragging(false);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full overflow-hidden",
        isDragging && "select-none cursor-col-resize"
      )}
    >
      {/* Left pane */}
      <div
        className="flex-shrink-0 h-full overflow-hidden"
        style={{ width: leftWidth }}
      >
        {left}
      </div>

      {/* Drag handle */}
      <div
        className={cn(
          "w-1 bg-panel-border cursor-col-resize hover:bg-brand-primary/50 transition-colors",
          isDragging && "bg-brand-primary"
        )}
        onMouseDown={() => setIsDragging(true)}
      />

      {/* Right pane */}
      <div className="flex-1 overflow-hidden">{right}</div>
    </div>
  );
}
