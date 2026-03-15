/**
 * ExportTestModal component - Generate test code from events
 */

import { useState } from "react";
import { Button } from "../common";
import { usePanelStore } from "../../store";
import { generateTestCode } from "@shared/generators";
import { TEST_FRAMEWORK, ASSERTION_STYLE } from "@shared/types";
import type { TestFramework, AssertionStyle, DataLayerEvent } from "@shared/types";
import { cn } from "@/lib/utils";

interface ExportTestModalProps {
  events: readonly DataLayerEvent[];
  onClose: () => void;
}

export function ExportTestModal({ events, onClose }: ExportTestModalProps) {
  const currentUrl = usePanelStore((s) => s.events[0]?.url ?? "");

  const [framework, setFramework] = useState<TestFramework>(TEST_FRAMEWORK.PLAYWRIGHT);
  const [assertionStyle, setAssertionStyle] = useState<AssertionStyle>(ASSERTION_STYLE.TYPE_ONLY);
  const [includeNavigation, setIncludeNavigation] = useState(true);
  const [includeWaits, setIncludeWaits] = useState(true);
  const [testName, setTestName] = useState("dataLayer events test");
  const [copied, setCopied] = useState(false);

  const generatedCode = generateTestCode(events, {
    framework,
    assertionStyle,
    includeNavigation,
    includeWaits,
    testName,
    url: currentUrl,
  });

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(generatedCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload(): void {
    const blob = new Blob([generatedCode.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = generatedCode.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-panel-bg border border-panel-border rounded-lg shadow-xl w-[800px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-panel-border">
          <div className="flex items-center gap-2">
            <CodeIcon className="w-5 h-5 text-brand-primary" />
            <h2 className="text-sm font-medium">Export as Test Code</h2>
            <span className="text-xs text-gray-500">
              {events.length} event{events.length !== 1 ? "s" : ""}
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <CloseIcon className="w-4 h-4" />
          </Button>
        </div>

        {/* Options */}
        <div className="px-4 py-3 border-b border-panel-border space-y-3">
          {/* Framework */}
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-gray-400 w-24">Framework</label>
            <div className="flex gap-2">
              <ToggleButton
                active={framework === TEST_FRAMEWORK.PLAYWRIGHT}
                onClick={() => setFramework(TEST_FRAMEWORK.PLAYWRIGHT)}
              >
                Playwright
              </ToggleButton>
              <ToggleButton
                active={framework === TEST_FRAMEWORK.CYPRESS}
                onClick={() => setFramework(TEST_FRAMEWORK.CYPRESS)}
              >
                Cypress
              </ToggleButton>
            </div>
          </div>

          {/* Assertion style */}
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-gray-400 w-24">Assertions</label>
            <div className="flex gap-2">
              <ToggleButton
                active={assertionStyle === ASSERTION_STYLE.TYPE_ONLY}
                onClick={() => setAssertionStyle(ASSERTION_STYLE.TYPE_ONLY)}
              >
                Type-only
              </ToggleButton>
              <ToggleButton
                active={assertionStyle === ASSERTION_STYLE.EXACT}
                onClick={() => setAssertionStyle(ASSERTION_STYLE.EXACT)}
              >
                Exact values
              </ToggleButton>
            </div>
          </div>

          {/* Test name */}
          <div className="flex items-center gap-4">
            <label className="text-xs font-medium text-gray-400 w-24">Test name</label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="flex-1 px-2 py-1 text-sm rounded border border-panel-border bg-panel-surface text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          {/* Options row */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={includeNavigation}
                onChange={(e) => setIncludeNavigation(e.target.checked)}
                className="rounded border-panel-border bg-panel-surface"
              />
              Include navigation
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={includeWaits}
                onChange={(e) => setIncludeWaits(e.target.checked)}
                className="rounded border-panel-border bg-panel-surface"
              />
              Include waits (SPA)
            </label>
          </div>
        </div>

        {/* Code preview */}
        <div className="flex-1 overflow-hidden">
          <pre className="h-full overflow-auto p-4 text-xs font-mono text-gray-300 bg-panel-surface">
            {generatedCode.code}
          </pre>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-panel-border">
          <span className="text-xs text-gray-500">{generatedCode.filename}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={handleCopy}>
              {copied ? (
                <>
                  <CheckIcon className="w-4 h-4 mr-1 text-green-400" />
                  Copied!
                </>
              ) : (
                <>
                  <CopyIcon className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
            <Button size="sm" variant="primary" onClick={handleDownload}>
              <DownloadIcon className="w-4 h-4 mr-1" />
              Download
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 text-xs font-medium rounded transition-colors",
        active
          ? "bg-brand-primary text-white"
          : "bg-panel-surface text-gray-400 hover:text-gray-200"
      )}
    >
      {children}
    </button>
  );
}

// Icons
function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
