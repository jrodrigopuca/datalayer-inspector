/**
 * Schema validation types
 *
 * Template-based validation where users define expected JSON structure
 * with type placeholders like @string, @number, @boolean, @array, @any
 *
 * Extended syntax:
 * - @string? - optional string (field can be missing)
 * - @enum(a, b, c) - must be one of the specified values
 * - @optional - alias for @any? (field can be missing, any type allowed)
 */

/**
 * Type placeholders for template values
 * @string - any string value
 * @number - any numeric value
 * @boolean - true or false
 * @array - any array
 * @object - any object
 * @any - any value (just checks existence)
 *
 * Modifiers:
 * - ? suffix makes it optional: @string?, @number?
 * - @enum(val1, val2) for enumerated values
 * - @optional - alias for @any? (optional field, any type)
 */
export const TYPE_PLACEHOLDER = {
  STRING: "@string",
  NUMBER: "@number",
  BOOLEAN: "@boolean",
  ARRAY: "@array",
  OBJECT: "@object",
  ANY: "@any",
} as const;

export type TypePlaceholder =
  (typeof TYPE_PLACEHOLDER)[keyof typeof TYPE_PLACEHOLDER];

/**
 * All valid type placeholders
 */
export const TYPE_PLACEHOLDERS: readonly TypePlaceholder[] = [
  TYPE_PLACEHOLDER.STRING,
  TYPE_PLACEHOLDER.NUMBER,
  TYPE_PLACEHOLDER.BOOLEAN,
  TYPE_PLACEHOLDER.ARRAY,
  TYPE_PLACEHOLDER.OBJECT,
  TYPE_PLACEHOLDER.ANY,
];

/**
 * Check if a value is a basic type placeholder (without modifiers)
 */
export function isTypePlaceholder(value: unknown): value is TypePlaceholder {
  return (
    typeof value === "string" &&
    TYPE_PLACEHOLDERS.includes(value as TypePlaceholder)
  );
}

/**
 * Check if a value is an extended placeholder (includes optional and enum)
 */
export function isExtendedPlaceholder(value: unknown): boolean {
  if (typeof value !== "string" || !value.startsWith("@")) {
    return false;
  }
  // Basic placeholders
  if (isTypePlaceholder(value)) {
    return true;
  }
  // @optional alias (equivalent to @any?)
  if (value === "@optional") {
    return true;
  }
  // Optional placeholders: @string?, @number?, etc.
  if (value.endsWith("?")) {
    const base = value.slice(0, -1);
    return TYPE_PLACEHOLDERS.includes(base as TypePlaceholder);
  }
  // Enum placeholder: @enum(value1, value2, ...)
  if (value.startsWith("@enum(") && value.endsWith(")")) {
    return true;
  }
  return false;
}

/**
 * Parse an extended placeholder into its components
 */
export interface ParsedPlaceholder {
  type: "basic" | "optional" | "enum";
  baseType?: TypePlaceholder;
  enumValues?: readonly string[];
}

export function parsePlaceholder(value: string): ParsedPlaceholder | null {
  if (!value.startsWith("@")) {
    return null;
  }

  // @optional alias (equivalent to @any?)
  if (value === "@optional") {
    return {
      type: "optional",
      baseType: TYPE_PLACEHOLDER.ANY,
    };
  }

  // Enum: @enum(value1, value2, ...)
  if (value.startsWith("@enum(") && value.endsWith(")")) {
    const inner = value.slice(6, -1); // Remove "@enum(" and ")"
    const values = inner.split(",").map((v) => v.trim());
    return {
      type: "enum",
      enumValues: values,
    };
  }

  // Optional: @string?, @number?, etc.
  if (value.endsWith("?")) {
    const base = value.slice(0, -1) as TypePlaceholder;
    if (TYPE_PLACEHOLDERS.includes(base)) {
      return {
        type: "optional",
        baseType: base,
      };
    }
    return null;
  }

  // Basic: @string, @number, etc.
  if (TYPE_PLACEHOLDERS.includes(value as TypePlaceholder)) {
    return {
      type: "basic",
      baseType: value as TypePlaceholder,
    };
  }

  return null;
}

/**
 * Template value - can be a literal, type placeholder, nested object, or array pattern
 */
export type TemplateValue =
  | string // literal "percent" or placeholder "@string"
  | number // literal 25
  | boolean // literal true/false
  | null // literal null
  | TemplateObject // nested { key: value }
  | TemplateArray; // array pattern [{ item_id: "@string" }]

/**
 * Template object - keys map to template values
 */
export interface TemplateObject {
  [key: string]: TemplateValue;
}

/**
 * Template array - first element defines the pattern for all elements
 * Empty array means "must be an array, contents not validated"
 */
export type TemplateArray = TemplateValue[];

/**
 * A validation schema
 */
export interface Schema {
  /** Unique identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** The expected JSON structure */
  readonly template: TemplateObject;
  /** Whether validation is active */
  readonly enabled: boolean;
  /** Optional description */
  readonly description?: string;
  /** When the schema was created */
  readonly createdAt: number;
  /** When the schema was last modified */
  readonly updatedAt: number;
}

/**
 * Schema without readonly for creation/editing
 */
export interface MutableSchema {
  id: string;
  name: string;
  template: TemplateObject;
  enabled: boolean;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Data needed to create a new schema
 */
export interface CreateSchemaInput {
  name: string;
  template: TemplateObject;
  description?: string;
  enabled?: boolean;
}

/**
 * Data for updating an existing schema
 */
export interface UpdateSchemaInput {
  name?: string;
  template?: TemplateObject;
  description?: string;
  enabled?: boolean;
}

/**
 * Validation error detail
 */
export interface ValidationError {
  /** JSON path where error occurred, e.g., "ecommerce.items[0].price" */
  readonly path: string;
  /** Human-readable error message */
  readonly message: string;
  /** What was expected */
  readonly expected?: string;
  /** What was actually found */
  readonly actual?: string;
}

/**
 * Result of validating a single event against a single schema
 */
export interface ValidationResult {
  /** The schema that was applied */
  readonly schemaId: string;
  readonly schemaName: string;
  /** Overall status */
  readonly status: "pass" | "fail";
  /** List of errors (empty if pass) */
  readonly errors: readonly ValidationError[];
}

/**
 * Aggregated validation results for an event (may match multiple schemas)
 */
export interface EventValidation {
  /** Event ID */
  readonly eventId: string;
  /** Overall status (fail if ANY schema failed) */
  readonly status: "pass" | "fail" | "none";
  /** Results per schema */
  readonly results: readonly ValidationResult[];
}

/**
 * Create a new schema with defaults
 */
export function createSchema(input: CreateSchemaInput): Schema {
  const now = Date.now();
  const schema: Schema = {
    id: crypto.randomUUID(),
    name: input.name,
    template: input.template,
    enabled: input.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };
  
  // Only add description if provided
  if (input.description !== undefined) {
    return { ...schema, description: input.description };
  }
  
  return schema;
}

/**
 * Get event name from template (looks for "event" key)
 */
export function getSchemaEventName(schema: Schema): string | null {
  const eventValue = schema.template["event"];
  if (typeof eventValue === "string" && !isTypePlaceholder(eventValue)) {
    return eventValue;
  }
  return null;
}
