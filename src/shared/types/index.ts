/**
 * Shared types - Re-exports
 *
 * All types that cross boundaries between extension contexts
 */

// Core event types
export type {
  DataLayerEvent,
  EventId,
  GTMContainer,
  MutableTabState,
  TabState,
} from "./events";

export { createInitialTabState, toReadonlyTabState } from "./events";
// Evidence export types
export type {
  EventViewMode,
  EvidenceFormat,
  EvidenceOptions,
  GeneratedEvidence,
} from "./evidence";
export {
  DEFAULT_EVIDENCE_OPTIONS,
  EVENT_VIEW_MODE,
  EVIDENCE_FORMAT,
} from "./evidence";
// Message types
export type {
  BackgroundMessageType,
  BackgroundToClientMessage,
  BackgroundToContentMessage,
  ClientRequestType,
  ClientResponseType,
  ClientToBackgroundRequest,
  ClientToBackgroundResponse,
  ContentMessageType,
  ContentToBackgroundMessage,
  PageContainersDetectedPayload,
  PageEventCapturedPayload,
  PageInitializedPayload,
  PageMessageType,
  PageToContentMessage,
  PortName,
  TabResetReason,
} from "./messages";
export {
  BACKGROUND_MESSAGE_TYPE,
  BACKGROUND_TO_CONTENT_TYPE,
  CLIENT_REQUEST_TYPE,
  CLIENT_RESPONSE_TYPE,
  CONTENT_MESSAGE_TYPE,
  MESSAGE_SOURCE,
  PAGE_MESSAGE_TYPE,
  PORT_NAME,
  TAB_RESET_REASON,
} from "./messages";
// Schema types
export type {
  CreateSchemaInput,
  EventValidation,
  MutableSchema,
  ParsedPlaceholder,
  Schema,
  TemplateArray,
  TemplateObject,
  TemplateValue,
  TypePlaceholder,
  UpdateSchemaInput,
  ValidationError,
  ValidationResult,
} from "./schema";
export {
  createSchema,
  getSchemaEventName,
  isExtendedPlaceholder,
  isTypePlaceholder,
  parsePlaceholder,
  TYPE_PLACEHOLDER,
  TYPE_PLACEHOLDERS,
} from "./schema";
// Settings types
export type { SettingsUpdate, Theme, UserSettings } from "./settings";
export { DEFAULT_SETTINGS, THEME } from "./settings";
// Test generator types
export type {
  AssertionStyle,
  GeneratedTest,
  TestFramework,
  TestGeneratorOptions,
} from "./test-generator";
export { ASSERTION_STYLE, TEST_FRAMEWORK } from "./test-generator";
