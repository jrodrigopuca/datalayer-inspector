/**
 * TreeNode component - recursive JSON tree node
 */

import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePanelStore } from "../../store";
import { ArrowIcon, CheckIcon, CopyIcon } from "../common";

interface TreeNodeProps {
  keyName: string | number;
  value: unknown;
  path: string;
  depth: number;
}

const MAX_DEPTH = 20;
const INDENT_PX = 16;

/**
 * Get display type and preview for a value
 */
function getValueInfo(value: unknown): {
  type: "string" | "number" | "boolean" | "null" | "array" | "object";
  preview: string;
  expandable: boolean;
} {
  if (value === null) {
    return { type: "null", preview: "null", expandable: false };
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      preview: `Array(${value.length})`,
      expandable: value.length > 0,
    };
  }

  switch (typeof value) {
    case "string":
      return { type: "string", preview: `"${value}"`, expandable: false };
    case "number":
      return { type: "number", preview: String(value), expandable: false };
    case "boolean":
      return { type: "boolean", preview: String(value), expandable: false };
    case "object": {
      const keys = Object.keys(value as object);
      return {
        type: "object",
        preview: `{${keys.length} keys}`,
        expandable: keys.length > 0,
      };
    }
    default:
      return { type: "string", preview: String(value), expandable: false };
  }
}

const typeColors: Record<string, string> = {
  string: "text-green-400",
  number: "text-blue-400",
  boolean: "text-purple-400",
  null: "text-gray-500",
  array: "text-gray-400",
  object: "text-gray-400",
};

/**
 * Strip the internal "root." prefix so the copied path matches how
 * the payload is accessed in code: "ecommerce.items.0.price"
 */
function toDisplayPath(path: string): string {
  return path.startsWith("root.") ? path.slice(5) : path;
}

export function TreeNode({ keyName, value, path, depth }: TreeNodeProps) {
  const expandedPaths = usePanelStore((s) => s.expandedPaths);
  const togglePath = usePanelStore((s) => s.togglePath);
  const [copied, setCopied] = useState(false);

  const isExpanded = expandedPaths.has(path);
  const { type, preview, expandable } = getValueInfo(value);

  async function copyPath(): Promise<void> {
    try {
      await navigator.clipboard.writeText(toDisplayPath(path));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("[Strata] Failed to copy path:", error);
    }
  }

  // Prevent infinite depth
  if (depth > MAX_DEPTH) {
    return (
      <div
        className="text-gray-500 italic"
        style={{ paddingLeft: depth * INDENT_PX }}
      >
        [Max depth reached]
      </div>
    );
  }

  // Get children for expandable types
  let children: Array<{ key: string | number; value: unknown }> = [];
  if (expandable && isExpanded) {
    if (Array.isArray(value)) {
      children = value.map((v, i) => ({ key: i, value: v }));
    } else if (typeof value === "object" && value !== null) {
      children = Object.entries(value).map(([k, v]) => ({ key: k, value: v }));
    }
  }

  return (
    <div>
      {/* Node row */}
      <div
        className={cn(
          "group flex items-center h-6 hover:bg-panel-surface/50 cursor-default",
          "font-mono text-sm"
        )}
        style={{ paddingLeft: depth * INDENT_PX }}
      >
        {/* Expand/collapse arrow */}
        {expandable ? (
          <button
            type="button"
            onClick={() => togglePath(path)}
            className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-300"
          >
            <ArrowIcon
              className={cn(
                "w-3 h-3 transition-transform",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Key name */}
        <span className="text-blue-300 mr-1">{keyName}</span>
        <span className="text-gray-500 mr-1">:</span>

        {/* Value or preview */}
        {expandable ? (
          <span className={cn(typeColors[type], "flex-1 min-w-0 truncate")}>
            {preview}
          </span>
        ) : (
          <span
            className={cn(typeColors[type], "flex-1 min-w-0 truncate")}
            title={preview}
          >
            {preview}
          </span>
        )}

        {/* Copy path (visible on hover) */}
        <button
          type="button"
          onClick={() => void copyPath()}
          title={`Copy path: ${toDisplayPath(path)}`}
          className={cn(
            "ml-2 w-4 h-4 flex items-center justify-center flex-shrink-0",
            "text-gray-500 hover:text-gray-300 transition-opacity",
            copied ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          {copied ? (
            <CheckIcon className="w-3 h-3 text-green-400" />
          ) : (
            <CopyIcon className="w-3 h-3" />
          )}
        </button>
      </div>

      {/* Children */}
      {isExpanded &&
        children.map((child) => (
          <TreeNode
            key={String(child.key)}
            keyName={child.key}
            value={child.value}
            path={`${path}.${child.key}`}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}
