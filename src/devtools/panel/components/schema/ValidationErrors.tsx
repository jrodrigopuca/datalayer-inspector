/**
 * ValidationErrors component - shows validation errors for a specific event
 */

import { usePanelStore } from "../../store";
import { useValidation } from "../../hooks";
import { Button } from "../common";

interface ValidationErrorsProps {
  eventId: string;
}

export function ValidationErrors({ eventId }: ValidationErrorsProps) {
  const { getValidation } = useValidation();
  const showEventDetail = usePanelStore((s) => s.showEventDetail);
  const events = usePanelStore((s) => s.events);

  const validation = getValidation(eventId);
  const event = events.find((e) => e.id === eventId);

  if (!validation || !event) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <p className="text-sm">Event not found</p>
      </div>
    );
  }

  const failedResults = validation.results.filter((r) => r.status === "fail");

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border bg-panel-surface">
        <div className="flex items-center gap-2">
          <ErrorIcon className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-medium">Validation Errors</h2>
          <span className="text-xs text-gray-500">
            {event.eventName ?? "(push)"}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={showEventDetail} title="Back">
          <CloseIcon className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {validation.status === "pass" && (
          <div className="flex flex-col items-center justify-center h-full text-green-400">
            <CheckIcon className="w-12 h-12 mb-2" />
            <p className="text-sm font-medium">All validations passed</p>
            <p className="text-xs text-gray-500 mt-1">
              {validation.results.length} schema(s) matched
            </p>
          </div>
        )}

        {validation.status === "none" && (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p className="text-sm">No matching schemas</p>
            <p className="text-xs mt-1">
              Create a schema to validate this event
            </p>
          </div>
        )}

        {validation.status === "fail" && (
          <div className="space-y-3">
            {failedResults.map((result) => (
              <div
                key={result.schemaId}
                className="p-2 rounded border border-red-500/30 bg-red-500/10"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-red-400">
                    {result.schemaName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {result.errors.length} error(s)
                  </span>
                </div>
                <div className="space-y-1.5">
                  {result.errors.map((error, idx) => (
                    <div key={idx} className="text-xs">
                      <code className="text-yellow-400">{error.path}</code>
                      <span className="text-gray-400 ml-2">{error.message}</span>
                      {error.expected && error.actual && (
                        <div className="mt-0.5 pl-2 text-gray-500">
                          Expected: <span className="text-green-400">{error.expected}</span>
                          {" → "}
                          Got: <span className="text-red-400">{error.actual}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
