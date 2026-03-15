/**
 * Shared types - Re-exports
 *
 * All types that cross boundaries between extension contexts
 */

// Core event types
export type {
  EventId,
  DataLayerEvent,
  TabState,
  GTMContainer,
  MutableTabState,
} from "./events";

export { toReadonlyTabState, createInitialTabState } from "./events";

// Settings types
export type { Theme, UserSettings, SettingsUpdate } from "./settings";

export { THEME, DEFAULT_SETTINGS } from "./settings";

// Schema types
export type {
  TypePlaceholder,
  TemplateValue,
  TemplateObject,
  TemplateArray,
  Schema,
  MutableSchema,
  CreateSchemaInput,
  UpdateSchemaInput,
  ValidationError,
  ValidationResult,
  EventValidation,
  ParsedPlaceholder,
} from "./schema";

export {
  TYPE_PLACEHOLDER,
  TYPE_PLACEHOLDERS,
  isTypePlaceholder,
  isExtendedPlaceholder,
  parsePlaceholder,
  createSchema,
  getSchemaEventName,
} from "./schema";

// Message types
export type {
  PortName,
  PageMessageType,
  PageEventCapturedPayload,
  PageContainersDetectedPayload,
  PageInitializedPayload,
  PageToContentMessage,
  ContentMessageType,
  ContentToBackgroundMessage,
  BackgroundMessageType,
  TabResetReason,
  BackgroundToClientMessage,
  ClientRequestType,
  ClientToBackgroundRequest,
  ClientResponseType,
  ClientToBackgroundResponse,
} from "./messages";

export {
  MESSAGE_SOURCE,
  PORT_NAME,
  PAGE_MESSAGE_TYPE,
  CONTENT_MESSAGE_TYPE,
  BACKGROUND_MESSAGE_TYPE,
  TAB_RESET_REASON,
  CLIENT_REQUEST_TYPE,
  CLIENT_RESPONSE_TYPE,
} from "./messages";

// Test generator types
export type {
  TestFramework,
  AssertionStyle,
  TestGeneratorOptions,
  GeneratedTest,
} from "./test-generator";

export { TEST_FRAMEWORK, ASSERTION_STYLE } from "./test-generator";

// Evidence export types
export type {
  EvidenceFormat,
  EvidenceOptions,
  GeneratedEvidence,
} from "./evidence";

export { EVIDENCE_FORMAT, DEFAULT_EVIDENCE_OPTIONS } from "./evidence";
