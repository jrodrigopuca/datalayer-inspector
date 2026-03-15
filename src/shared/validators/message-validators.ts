/**
 * Message validators for type-safe message handling
 *
 * These type guards ensure messages from untrusted sources
 * conform to expected shapes before processing
 */

import {
  MESSAGE_SOURCE,
  PAGE_MESSAGE_TYPE,
  CONTENT_MESSAGE_TYPE,
  CLIENT_REQUEST_TYPE,
} from "../types";
import type {
  PageToContentMessage,
  ContentToBackgroundMessage,
  ClientToBackgroundRequest,
} from "../types";

/**
 * Check if a value is a non-null object
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Check if value has required string property
 */
function hasStringProp(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === "string";
}

/**
 * Check if value has required number property
 */
function hasNumberProp(obj: Record<string, unknown>, key: string): boolean {
  return typeof obj[key] === "number";
}

// ============================================================================
// Page → Content Message Validators
// ============================================================================

/**
 * Validate message from page script via window.postMessage
 *
 * CRITICAL: This is a security boundary - page can send any data
 */
export function isPageToContentMessage(
  data: unknown
): data is PageToContentMessage {
  if (!isObject(data)) return false;
  if (data.source !== MESSAGE_SOURCE) return false;
  if (!hasStringProp(data, "type")) return false;

  const type = data.type as string;

  switch (type) {
    case PAGE_MESSAGE_TYPE.EVENT_CAPTURED:
      return isEventCapturedPayload(data.payload);

    case PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED:
      return isContainersDetectedPayload(data.payload);

    case PAGE_MESSAGE_TYPE.INITIALIZED:
      return isInitializedPayload(data.payload);

    default:
      return false;
  }
}

function isEventCapturedPayload(payload: unknown): boolean {
  if (!isObject(payload)) return false;

  return (
    hasStringProp(payload, "id") &&
    hasNumberProp(payload, "timestamp") &&
    hasStringProp(payload, "url") &&
    (payload.eventName === null || hasStringProp(payload, "eventName")) &&
    isObject(payload.data) &&
    Array.isArray(payload.containerIds) &&
    hasStringProp(payload, "sourceName") &&
    hasNumberProp(payload, "index")
  );
}

function isContainersDetectedPayload(payload: unknown): boolean {
  if (!isObject(payload)) return false;
  if (!Array.isArray(payload.containers)) return false;

  return payload.containers.every(
    (c: unknown) =>
      isObject(c) && hasStringProp(c, "id") && hasStringProp(c, "dataLayerName")
  );
}

function isInitializedPayload(payload: unknown): boolean {
  if (!isObject(payload)) return false;

  return (
    Array.isArray(payload.dataLayerNames) &&
    payload.dataLayerNames.every((n: unknown) => typeof n === "string") &&
    hasNumberProp(payload, "existingEventsCount")
  );
}

// ============================================================================
// Content → Background Message Validators
// ============================================================================

/**
 * Validate message from content script
 *
 * Less critical than page messages, but still from untrusted tab context
 */
export function isContentToBackgroundMessage(
  data: unknown
): data is ContentToBackgroundMessage {
  if (!isObject(data)) return false;
  if (!hasStringProp(data, "type")) return false;

  const type = data.type as string;

  switch (type) {
    case CONTENT_MESSAGE_TYPE.EVENT:
      return isDataLayerEventPayload(data.payload);

    case CONTENT_MESSAGE_TYPE.CONTAINERS:
      return isContainersPayload(data.payload);

    case CONTENT_MESSAGE_TYPE.INIT:
      return isInitPayload(data.payload);

    default:
      return false;
  }
}

function isDataLayerEventPayload(payload: unknown): boolean {
  if (!isObject(payload)) return false;

  return (
    hasStringProp(payload, "id") &&
    hasNumberProp(payload, "timestamp") &&
    hasStringProp(payload, "url") &&
    (payload.eventName === null || hasStringProp(payload, "eventName")) &&
    isObject(payload.data) &&
    Array.isArray(payload.containerIds) &&
    hasStringProp(payload, "source") &&
    hasNumberProp(payload, "index")
  );
}

function isContainersPayload(payload: unknown): boolean {
  if (!isObject(payload)) return false;
  if (!Array.isArray(payload.containers)) return false;

  return payload.containers.every(
    (c: unknown) =>
      isObject(c) && hasStringProp(c, "id") && hasStringProp(c, "dataLayerName")
  );
}

function isInitPayload(payload: unknown): boolean {
  if (!isObject(payload)) return false;

  return (
    Array.isArray(payload.dataLayerNames) &&
    hasNumberProp(payload, "existingEventsCount")
  );
}

// ============================================================================
// Client → Background Request Validators
// ============================================================================

/**
 * Validate request from DevTools panel or popup
 */
export function isClientToBackgroundRequest(
  data: unknown
): data is ClientToBackgroundRequest {
  if (!isObject(data)) return false;
  if (!hasStringProp(data, "type")) return false;

  const type = data.type as string;

  switch (type) {
    case CLIENT_REQUEST_TYPE.GET_EVENTS:
    case CLIENT_REQUEST_TYPE.GET_CONTAINERS:
    case CLIENT_REQUEST_TYPE.CLEAR_EVENTS:
    case CLIENT_REQUEST_TYPE.GET_TAB_STATE:
      return isTabIdPayload(data.payload);

    case CLIENT_REQUEST_TYPE.SET_RECORDING:
      return isSetRecordingPayload(data.payload);

    case CLIENT_REQUEST_TYPE.GET_SETTINGS:
      return true; // No payload needed

    case CLIENT_REQUEST_TYPE.UPDATE_SETTINGS:
      return isObject(data.payload);

    default:
      return false;
  }
}

function isTabIdPayload(payload: unknown): boolean {
  if (!isObject(payload)) return false;
  return hasNumberProp(payload, "tabId");
}

function isSetRecordingPayload(payload: unknown): boolean {
  if (!isObject(payload)) return false;
  return (
    hasNumberProp(payload, "tabId") && typeof payload.isRecording === "boolean"
  );
}
