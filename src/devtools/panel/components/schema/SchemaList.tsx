/**
 * SchemaList component - displays all validation schemas
 */

import { useRef } from "react";
import { usePanelStore } from "../../store";
import { useSchemas } from "../../hooks";
import { Button, Toggle } from "../common";
import type { Schema } from "@shared/types";

export function SchemaList() {
  const { schemas, toggleSchema, deleteSchema, importSchemas, exportSchemas } = useSchemas();
  const showSchemaEditor = usePanelStore((s) => s.showSchemaEditor);
  const showEventDetail = usePanelStore((s) => s.showEventDetail);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enabledCount = schemas.filter((s) => s.enabled).length;

  function handleExport(): void {
    const data = exportSchemas();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `strata-schemas-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportClick(): void {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string) as Schema[];
        if (Array.isArray(data)) {
          importSchemas(data);
        }
      } catch (err) {
        console.error("[Strata] Failed to import schemas:", err);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = "";
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border bg-panel-surface">
        <div className="flex items-center gap-2">
          <SchemaIcon className="w-4 h-4 text-brand-primary" />
          <h2 className="text-sm font-medium">Validation Schemas</h2>
          <span className="text-xs text-gray-500">
            ({enabledCount}/{schemas.length} active)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleImportClick}
            title="Import schemas"
          >
            <ImportIcon className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleExport}
            disabled={schemas.length === 0}
            title="Export schemas"
          >
            <ExportIcon className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => showSchemaEditor(null)}
            title="Create new schema"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            New
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={showEventDetail}
            title="Back to event detail"
          >
            <CloseIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Schema list */}
      <div className="flex-1 overflow-y-auto">
        {schemas.length === 0 ? (
          <EmptyState onCreateNew={() => showSchemaEditor(null)} />
        ) : (
          <div className="divide-y divide-panel-border">
            {schemas.map((schema) => {
              const itemProps: SchemaItemProps = {
                id: schema.id,
                name: schema.name,
                enabled: schema.enabled,
                eventName: getSchemaEventName(schema.template),
                onToggle: () => toggleSchema(schema.id),
                onEdit: () => showSchemaEditor(schema.id),
                onDelete: () => deleteSchema(schema.id),
              };
              if (schema.description) {
                itemProps.description = schema.description;
              }
              return <SchemaItem key={schema.id} {...itemProps} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

interface SchemaItemProps {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  eventName: string | null;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SchemaItem({
  name,
  description,
  enabled,
  eventName,
  onToggle,
  onEdit,
  onDelete,
}: SchemaItemProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-panel-surface/50 transition-colors group">
      {/* Toggle */}
      <Toggle checked={enabled} onChange={onToggle} label={`Toggle ${name}`} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{name}</span>
          {eventName && (
            <span className="px-1.5 py-0.5 text-2xs font-mono bg-event-gtm/20 text-event-gtm rounded truncate max-w-32">
              {eventName}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="sm" variant="ghost" onClick={onEdit} title="Edit schema">
          <EditIcon className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          title="Delete schema"
        >
          <TrashIcon className="w-3.5 h-3.5 text-red-400 hover:text-red-300" />
        </Button>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  onCreateNew: () => void;
}

function EmptyState({ onCreateNew }: EmptyStateProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-gray-500 px-4">
      <SchemaIcon className="w-12 h-12 mb-3 opacity-50" />
      <p className="text-sm font-medium mb-1">No schemas yet</p>
      <p className="text-xs text-center mb-4">
        Create validation schemas to check your dataLayer events against
        expected structures
      </p>
      <Button variant="primary" size="sm" onClick={onCreateNew}>
        <PlusIcon className="w-4 h-4 mr-1" />
        Create your first schema
      </Button>
    </div>
  );
}

/**
 * Extract event name from schema template
 */
function getSchemaEventName(
  template: Record<string, unknown>
): string | null {
  const eventValue = template.event;
  if (typeof eventValue === "string" && !eventValue.startsWith("@")) {
    return eventValue;
  }
  return null;
}

// Icons
function SchemaIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

function ImportIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );
}

function ExportIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}
