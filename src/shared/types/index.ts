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
} from "./schema";

export {
  TYPE_PLACEHOLDER,
  TYPE_PLACEHOLDERS,
  isTypePlaceholder,
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
