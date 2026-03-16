/**
 * JsonRawView component - raw JSON display with syntax highlighting
 */

import { useState } from "react";
import { Button, CopyIcon, CheckIcon } from "../common";
import { cn } from "@/lib/utils";

interface JsonRawViewProps {
  data: Record<string, unknown>;
}

export function JsonRawView({ data }: JsonRawViewProps) {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(data, null, 2);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Actions */}
      <div className="flex items-center gap-2 px-2 py-1 border-b border-panel-border">
        <Button size="sm" variant="ghost" onClick={handleCopy}>
          {copied ? (
            <>
              <CheckIcon className="w-4 h-4 mr-1 text-green-400" />
              Copied!
            </>
          ) : (
            <>
              <CopyIcon className="w-4 h-4 mr-1" />
              Copy JSON
            </>
          )}
        </Button>
        <span className="text-2xs text-gray-500">
          {jsonString.length} characters
        </span>
      </div>

      {/* Raw JSON */}
      <div className="flex-1 overflow-auto p-2">
        <pre
          className={cn(
            "text-sm font-mono text-gray-300 whitespace-pre-wrap break-all"
          )}
        >
          {jsonString}
        </pre>
      </div>
    </div>
  );
}
