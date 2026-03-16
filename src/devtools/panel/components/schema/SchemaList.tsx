/**
 * SchemaList component - displays all validation schemas
 */

import { useRef, useState } from "react";
import { usePanelStore } from "../../store";
import { useSchemas } from "../../hooks";
import {
  Button,
  Toggle,
  ConfirmDialog,
  SchemaIcon,
  PlusIcon,
  CloseIcon,
  EditIcon,
  TrashIcon,
  ImportIcon,
  ExportIcon,
} from "../common";
import type { Schema } from "@shared/types";

export function SchemaList() {
  const { schemas, toggleSchema, deleteSchema, importSchemas, exportSchemas } = useSchemas();
  const showSchemaEditor = usePanelStore((s) => s.showSchemaEditor);
  const showEventDetail = usePanelStore((s) => s.showEventDetail);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Confirm dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const enabledCount = schemas.filter((s) => s.enabled).length;

  function handleDeleteClick(id: string, name: string): void {
    setDeleteConfirm({ id, name });
  }

  function handleDeleteConfirm(): void {
    if (deleteConfirm) {
      deleteSchema(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  }

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
                onDelete: () => handleDeleteClick(schema.id, schema.name),
              };
              if (schema.description) {
                itemProps.description = schema.description;
              }
              return <SchemaItem key={schema.id} {...itemProps} />;
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Schema"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />
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
