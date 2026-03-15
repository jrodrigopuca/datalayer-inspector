/**
 * SchemaEditor component - create or edit validation schemas
 */

import { useState, useEffect } from "react";
import { usePanelStore } from "../../store";
import { useSchemas } from "../../hooks";
import { Button } from "../common";
import { cn } from "@/lib/utils";
import type { TemplateObject } from "@shared/types";

interface SchemaEditorProps {
  /** Schema ID to edit, or null for new schema */
  schemaId: string | null;
}

export function SchemaEditor({ schemaId }: SchemaEditorProps) {
  const { schemas, addSchema, updateSchema } = useSchemas();
  const showSchemaList = usePanelStore((s) => s.showSchemaList);

  const existingSchema = schemaId
    ? schemas.find((s) => s.id === schemaId)
    : null;

  const [name, setName] = useState(existingSchema?.name ?? "");
  const [description, setDescription] = useState(
    existingSchema?.description ?? ""
  );
  const [templateJson, setTemplateJson] = useState(() =>
    existingSchema
      ? JSON.stringify(existingSchema.template, null, 2)
      : getDefaultTemplate()
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Update form when schema changes
  useEffect(() => {
    if (existingSchema) {
      setName(existingSchema.name);
      setDescription(existingSchema.description ?? "");
      setTemplateJson(JSON.stringify(existingSchema.template, null, 2));
    }
  }, [existingSchema]);

  // Validate JSON as user types
  useEffect(() => {
    try {
      JSON.parse(templateJson);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, [templateJson]);

  const isValid = name.trim() !== "" && jsonError === null;

  function handleSave(): void {
    if (!isValid) return;

    setIsSaving(true);

    try {
      const template = JSON.parse(templateJson) as TemplateObject;
      const trimmedDescription = description.trim();

      if (schemaId && existingSchema) {
        const update: Parameters<typeof updateSchema>[1] = {
          name: name.trim(),
          template,
        };
        if (trimmedDescription) {
          update.description = trimmedDescription;
        }
        updateSchema(schemaId, update);
      } else {
        const input: Parameters<typeof addSchema>[0] = {
          name: name.trim(),
          template,
        };
        if (trimmedDescription) {
          input.description = trimmedDescription;
        }
        addSchema(input);
      }

      showSchemaList();
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-panel-border bg-panel-surface">
        <div className="flex items-center gap-2">
          <SchemaIcon className="w-4 h-4 text-brand-primary" />
          <h2 className="text-sm font-medium">
            {schemaId ? "Edit Schema" : "New Schema"}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={showSchemaList}
            title="Cancel"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleSave}
            disabled={!isValid || isSaving}
            title="Save schema"
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Name input */}
        <div>
          <label
            htmlFor="schema-name"
            className="block text-xs font-medium text-gray-400 mb-1"
          >
            Name <span className="text-red-400">*</span>
          </label>
          <input
            id="schema-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Page View Event"
            className={cn(
              "w-full px-2 py-1.5 text-sm rounded border bg-panel-bg text-gray-100",
              "focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent",
              "placeholder:text-gray-600",
              name.trim() === ""
                ? "border-red-500/50"
                : "border-panel-border"
            )}
          />
        </div>

        {/* Description input */}
        <div>
          <label
            htmlFor="schema-description"
            className="block text-xs font-medium text-gray-400 mb-1"
          >
            Description <span className="text-gray-600">(optional)</span>
          </label>
          <input
            id="schema-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Validates standard page view tracking"
            className={cn(
              "w-full px-2 py-1.5 text-sm rounded border bg-panel-bg text-gray-100 border-panel-border",
              "focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent",
              "placeholder:text-gray-600"
            )}
          />
        </div>

        {/* Template JSON textarea */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="schema-template"
              className="block text-xs font-medium text-gray-400"
            >
              Template <span className="text-red-400">*</span>
            </label>
            {jsonError && (
              <span className="text-2xs text-red-400">{jsonError}</span>
            )}
          </div>
          <textarea
            id="schema-template"
            value={templateJson}
            onChange={(e) => setTemplateJson(e.target.value)}
            spellCheck={false}
            className={cn(
              "w-full h-64 px-2 py-1.5 text-xs font-mono rounded border bg-panel-bg text-gray-100 resize-none",
              "focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent",
              jsonError ? "border-red-500/50" : "border-panel-border"
            )}
          />
          <TypePlaceholdersHelp />
        </div>
      </div>
    </div>
  );
}

function TypePlaceholdersHelp() {
  return (
    <div className="mt-2 p-2 rounded bg-panel-surface border border-panel-border">
      <p className="text-2xs font-medium text-gray-300 mb-1">
        Type Placeholders
      </p>
      <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-2xs text-gray-500">
        <span>
          <code className="text-event-gtm">@string</code> - any string
        </span>
        <span>
          <code className="text-event-gtm">@number</code> - any number
        </span>
        <span>
          <code className="text-event-gtm">@boolean</code> - true/false
        </span>
        <span>
          <code className="text-event-gtm">@array</code> - any array
        </span>
        <span>
          <code className="text-event-gtm">@object</code> - any object
        </span>
        <span>
          <code className="text-event-gtm">@any</code> - any value
        </span>
      </div>
      <p className="text-2xs text-gray-500 mt-1">
        Literal values (without @) must match exactly.
      </p>
    </div>
  );
}

function getDefaultTemplate(): string {
  return JSON.stringify(
    {
      event: "@string",
    },
    null,
    2
  );
}

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
