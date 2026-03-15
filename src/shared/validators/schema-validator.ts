/**
 * Schema validation engine
 *
 * Validates dataLayer events against user-defined JSON templates
 *
 * Supports:
 * - Basic placeholders: @string, @number, @boolean, @array, @object, @any
 * - Optional fields: @string?, @number?, etc.
 * - Enum values: @enum(value1, value2, value3)
 * - Literal matching: exact values like "page_view" or 123
 */

import type {
  Schema,
  TemplateValue,
  TemplateObject,
  ValidationError,
  ValidationResult,
  EventValidation,
  DataLayerEvent,
} from "../types";
import {
  isTypePlaceholder,
  isExtendedPlaceholder,
  parsePlaceholder,
  TYPE_PLACEHOLDER,
} from "../types";

/**
 * Get the display type of a JavaScript value
 */
function getValueType(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Check if a value matches a type placeholder
 */
function matchesTypePlaceholder(
  value: unknown,
  placeholder: string
): boolean {
  switch (placeholder) {
    case TYPE_PLACEHOLDER.STRING:
      return typeof value === "string";
    case TYPE_PLACEHOLDER.NUMBER:
      return typeof value === "number" && !Number.isNaN(value);
    case TYPE_PLACEHOLDER.BOOLEAN:
      return typeof value === "boolean";
    case TYPE_PLACEHOLDER.ARRAY:
      return Array.isArray(value);
    case TYPE_PLACEHOLDER.OBJECT:
      return (
        value !== null && typeof value === "object" && !Array.isArray(value)
      );
    case TYPE_PLACEHOLDER.ANY:
      return value !== undefined;
    default:
      return false;
  }
}

/**
 * Format a value for display in error messages
 */
function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "object") {
    try {
      const json = JSON.stringify(value);
      return json.length > 50 ? json.slice(0, 47) + "..." : json;
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

/**
 * Format expected type for error messages (improved version)
 */
function formatExpectedType(template: TemplateValue): string {
  if (typeof template !== "string") {
    if (template === null) return "null";
    if (Array.isArray(template)) return "array";
    if (typeof template === "object") return "object";
    return formatValue(template);
  }

  const parsed = parsePlaceholder(template);
  if (!parsed) {
    return formatValue(template);
  }

  switch (parsed.type) {
    case "basic":
      return parsed.baseType?.slice(1) ?? "unknown"; // Remove @
    case "optional":
      return `${parsed.baseType?.slice(1)} (optional)`;
    case "enum":
      return `one of: ${parsed.enumValues?.join(", ")}`;
    default:
      return template;
  }
}

/**
 * Check if a template value represents an optional field
 */
function isOptionalField(template: TemplateValue): boolean {
  if (typeof template !== "string") return false;
  const parsed = parsePlaceholder(template);
  return parsed?.type === "optional";
}

/**
 * Validate a value against a template value
 *
 * @param actual - The actual value from the event
 * @param expected - The template value (literal, placeholder, object, or array)
 * @param path - Current JSON path for error reporting
 * @param errors - Array to collect errors
 */
function validateValue(
  actual: unknown,
  expected: TemplateValue,
  path: string,
  errors: ValidationError[]
): void {
  // Handle extended placeholders (optional, enum, basic)
  if (typeof expected === "string" && expected.startsWith("@")) {
    const parsed = parsePlaceholder(expected);

    if (parsed) {
      switch (parsed.type) {
        case "optional":
          // Optional: if undefined, it's OK; otherwise validate the type
          if (actual === undefined) {
            return; // OK - optional field is missing
          }
          if (!matchesTypePlaceholder(actual, parsed.baseType!)) {
            errors.push({
              path,
              message: `Expected ${parsed.baseType!.slice(1)} (optional), got ${getValueType(actual)}`,
              expected: `${parsed.baseType!.slice(1)} (optional)`,
              actual: getValueType(actual),
            });
          }
          return;

        case "enum":
          // Enum: value must be one of the allowed values
          const enumValues = parsed.enumValues!;
          if (!enumValues.includes(String(actual))) {
            errors.push({
              path,
              message: `Expected one of [${enumValues.join(", ")}], got ${formatValue(actual)}`,
              expected: `one of: ${enumValues.join(", ")}`,
              actual: formatValue(actual),
            });
          }
          return;

        case "basic":
          // Basic type placeholder
          if (!matchesTypePlaceholder(actual, parsed.baseType!)) {
            errors.push({
              path,
              message: `Expected ${parsed.baseType!.slice(1)}, got ${getValueType(actual)}`,
              expected: parsed.baseType!.slice(1),
              actual: getValueType(actual),
            });
          }
          return;
      }
    }
    // If it starts with @ but isn't a valid placeholder, treat as literal
  }

  // Handle null
  if (expected === null) {
    if (actual !== null) {
      errors.push({
        path,
        message: `Expected null, got ${formatValue(actual)}`,
        expected: "null",
        actual: formatValue(actual),
      });
    }
    return;
  }

  // Handle arrays
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      errors.push({
        path,
        message: `Expected array, got ${getValueType(actual)}`,
        expected: "array",
        actual: getValueType(actual),
      });
      return;
    }

    // If template array has a pattern element, validate each item
    if (expected.length > 0) {
      const pattern = expected[0] as TemplateValue;
      for (let i = 0; i < actual.length; i++) {
        validateValue(actual[i], pattern, `${path}[${i}]`, errors);
      }
    }
    // Empty template array = just check it's an array (already done)
    return;
  }

  // Handle objects
  if (typeof expected === "object" && expected !== null) {
    if (typeof actual !== "object" || actual === null || Array.isArray(actual)) {
      errors.push({
        path,
        message: `Expected object, got ${getValueType(actual)}`,
        expected: "object",
        actual: getValueType(actual),
      });
      return;
    }

    // Validate each key in the template
    const actualObj = actual as Record<string, unknown>;
    for (const [key, templateValue] of Object.entries(expected)) {
      const actualValue = actualObj[key];
      const childPath = path ? `${path}.${key}` : key;

      // Check if key exists (unless it's optional)
      if (actualValue === undefined) {
        if (isOptionalField(templateValue)) {
          continue; // OK - optional field is missing
        }
        errors.push({
          path: childPath,
          message: `Missing required field`,
          expected: formatExpectedType(templateValue),
          actual: "undefined",
        });
        continue;
      }

      // Recursively validate
      validateValue(actualValue, templateValue, childPath, errors);
    }
    return;
  }

  // Handle literals (string, number, boolean)
  if (actual !== expected) {
    errors.push({
      path,
      message: `Expected ${formatValue(expected)}, got ${formatValue(actual)}`,
      expected: formatValue(expected),
      actual: formatValue(actual),
    });
  }
}

/**
 * Check if a schema matches an event
 *
 * A schema matches if ALL literal values in the template match the event data.
 * Type placeholders (@string, @number, etc.) are NOT used for matching.
 * Optional fields (@string?) and enums (@enum(...)) are NOT used for matching.
 * This allows schemas to be specific about which events they apply to.
 *
 * Example: A schema with { "event": "ga4.trackEvent", "event_name": "page_view" }
 * will ONLY match events where both fields have those exact values.
 */
export function schemaMatchesEvent(
  schema: Schema,
  event: DataLayerEvent
): boolean {
  return templateMatchesData(schema.template, event.data);
}

/**
 * Check if a value is an extended placeholder (for matching purposes)
 * Extended placeholders include: @string, @number?, @enum(...), etc.
 */
function isAnyPlaceholder(value: unknown): boolean {
  return isTypePlaceholder(value) || isExtendedPlaceholder(value);
}

/**
 * Check if all literal values in a template match the corresponding values in data
 */
function templateMatchesData(
  template: TemplateValue,
  data: unknown
): boolean {
  // Any placeholder (basic, optional, enum) always matches for matching purposes
  if (typeof template === "string" && isAnyPlaceholder(template)) {
    return true;
  }

  // Null literal must match exactly
  if (template === null) {
    return data === null;
  }

  // Arrays: if template has a pattern, we don't use it for matching
  // (arrays are structural, not literal matchers)
  if (Array.isArray(template)) {
    return true;
  }

  // Objects: recursively check all properties
  if (typeof template === "object" && template !== null) {
    // Data must also be an object
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return false;
    }

    const dataObj = data as Record<string, unknown>;

    // Check each template property
    for (const [key, templateValue] of Object.entries(template)) {
      const dataValue = dataObj[key];

      // If the template has a literal value, data MUST have that key
      // (for matching purposes - validation will catch missing fields later)
      if (!isAnyPlaceholder(templateValue) && dataValue === undefined) {
        // Literal in template but missing in data = no match
        if (isPrimitiveLiteral(templateValue)) {
          return false;
        }
        // For nested objects, check if they contain any literals
        if (typeof templateValue === "object" && templateValue !== null && containsLiterals(templateValue)) {
          return false;
        }
      }

      // Recursively check nested values
      if (!templateMatchesData(templateValue, dataValue)) {
        return false;
      }
    }

    return true;
  }

  // Primitive literals (string, number, boolean) must match exactly
  return template === data;
}

/**
 * Check if a value is a primitive literal (string, number, boolean)
 * Note: Placeholders (@string, @enum(...)) are NOT literals
 */
function isPrimitiveLiteral(value: TemplateValue): boolean {
  if (typeof value === "string") {
    // Strings starting with @ are placeholders, not literals
    return !value.startsWith("@");
  }
  const type = typeof value;
  return type === "number" || type === "boolean";
}

/**
 * Check if a template object contains any literal values (recursively)
 */
function containsLiterals(template: TemplateValue): boolean {
  if (typeof template === "string" && isAnyPlaceholder(template)) {
    return false;
  }

  if (isPrimitiveLiteral(template) || template === null) {
    return true;
  }

  if (Array.isArray(template)) {
    return template.some(containsLiterals);
  }

  if (typeof template === "object" && template !== null) {
    return Object.values(template).some(containsLiterals);
  }

  return false;
}

/**
 * Validate an event against a single schema
 */
export function validateEventAgainstSchema(
  event: DataLayerEvent,
  schema: Schema
): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate the event data against the template
  validateValue(event.data, schema.template as TemplateValue, "", errors);

  return {
    schemaId: schema.id,
    schemaName: schema.name,
    status: errors.length === 0 ? "pass" : "fail",
    errors,
  };
}

/**
 * Validate an event against all applicable schemas
 */
export function validateEvent(
  event: DataLayerEvent,
  schemas: readonly Schema[]
): EventValidation {
  // Find all enabled schemas that match this event
  const applicableSchemas = schemas.filter(
    (s) => s.enabled && schemaMatchesEvent(s, event)
  );

  // No schemas apply
  if (applicableSchemas.length === 0) {
    return {
      eventId: event.id,
      status: "none",
      results: [],
    };
  }

  // Validate against each applicable schema
  const results = applicableSchemas.map((schema) =>
    validateEventAgainstSchema(event, schema)
  );

  // Overall status: fail if any schema failed
  const hasFailed = results.some((r) => r.status === "fail");

  return {
    eventId: event.id,
    status: hasFailed ? "fail" : "pass",
    results,
  };
}

/**
 * Validate all events against all schemas
 */
export function validateAllEvents(
  events: readonly DataLayerEvent[],
  schemas: readonly Schema[]
): Map<string, EventValidation> {
  const validations = new Map<string, EventValidation>();

  for (const event of events) {
    validations.set(event.id, validateEvent(event, schemas));
  }

  return validations;
}

/**
 * Convert a real event to a template (auto-detect types)
 * Useful for "Create Schema from Event" feature
 */
export function eventToTemplate(
  data: Record<string, unknown>
): TemplateObject {
  const template: TemplateObject = {};

  for (const [key, value] of Object.entries(data)) {
    template[key] = valueToTemplate(value);
  }

  return template;
}

/**
 * Convert a value to its template equivalent
 */
function valueToTemplate(value: unknown): TemplateValue {
  if (value === null) return null;
  if (value === undefined) return TYPE_PLACEHOLDER.ANY;

  if (Array.isArray(value)) {
    // If array has elements, use first as pattern
    if (value.length > 0) {
      return [valueToTemplate(value[0])];
    }
    return [];
  }

  if (typeof value === "object") {
    return eventToTemplate(value as Record<string, unknown>);
  }

  // Convert primitives to type placeholders
  switch (typeof value) {
    case "string":
      return TYPE_PLACEHOLDER.STRING;
    case "number":
      return TYPE_PLACEHOLDER.NUMBER;
    case "boolean":
      return TYPE_PLACEHOLDER.BOOLEAN;
    default:
      return TYPE_PLACEHOLDER.ANY;
  }
}
