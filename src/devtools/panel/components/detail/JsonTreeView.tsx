/**
 * JsonTreeView component - tree view of JSON data
 */

import { TreeNode } from "./TreeNode";
import { usePanelStore } from "../../store";
import { Button } from "../common";

interface JsonTreeViewProps {
  data: Record<string, unknown>;
  rootPath?: string;
}

export function JsonTreeView({ data, rootPath = "root" }: JsonTreeViewProps) {
  const resetExpandedPaths = usePanelStore((s) => s.resetExpandedPaths);
  const expandedPaths = usePanelStore((s) => s.expandedPaths);

  const entries = Object.entries(data);

  function collapseAll(): void {
    resetExpandedPaths();
  }

  return (
    <div className="h-full flex flex-col">
      {/* Actions */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-panel-border">
        <Button size="sm" variant="ghost" onClick={collapseAll}>
          Collapse all
        </Button>
        <span className="text-2xs text-gray-500">
          {expandedPaths.size} expanded
        </span>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-auto p-2">
        {entries.map(([key, value]) => (
          <TreeNode
            key={key}
            keyName={key}
            value={value}
            path={`${rootPath}.${key}`}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}
