/**
 * Schema validation engine
 *
 * Validates dataLayer events against user-defined JSON templates
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
import { isTypePlaceholder, TYPE_PLACEHOLDER } from "../types";

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
  // Handle type placeholders
  if (isTypePlaceholder(expected)) {
    if (!matchesTypePlaceholder(actual, expected)) {
      errors.push({
        path,
        message: `Expected ${expected.slice(1)}, got ${getValueType(actual)}`,
        expected: expected.slice(1), // Remove @ prefix
        actual: getValueType(actual),
      });
    }
    return;
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

      // Check if key exists
      if (actualValue === undefined) {
        errors.push({
          path: childPath,
          message: "Missing required field",
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
 * Format expected type for error messages
 */
function formatExpectedType(template: TemplateValue): string {
  if (isTypePlaceholder(template)) {
    return template.slice(1); // Remove @ prefix
  }
  if (template === null) return "null";
  if (Array.isArray(template)) return "array";
  if (typeof template === "object") return "object";
  return formatValue(template);
}

/**
 * Check if a schema matches an event (by event name)
 */
export function schemaMatchesEvent(
  schema: Schema,
  event: DataLayerEvent
): boolean {
  const templateEvent = schema.template["event"];

  // If schema has no event key, it matches all events
  if (templateEvent === undefined) {
    return true;
  }

  // If template event is a placeholder, it matches any event
  if (isTypePlaceholder(templateEvent)) {
    return true;
  }

  // Literal match
  if (typeof templateEvent === "string") {
    return event.eventName === templateEvent;
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
