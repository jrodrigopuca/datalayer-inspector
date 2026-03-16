/**
 * Message types for communication between extension contexts
 *
 * Pattern: Each boundary has its own message types to maintain type safety
 */

import type { DataLayerEvent, GTMContainer, TabState } from "./events";
import type { UserSettings } from "./settings";

// ============================================================================
// Constants
// ============================================================================

/** Identifier to filter our messages from page noise */
export const MESSAGE_SOURCE = "__STRATA_DATALAYER_INSPECTOR__" as const;

/** Port names for long-lived connections */
export const PORT_NAME = {
  DEVTOOLS_PANEL: "strata-devtools-panel",
  POPUP: "strata-popup",
} as const;

export type PortName = (typeof PORT_NAME)[keyof typeof PORT_NAME];

// ============================================================================
// Page Script → Content Script (window.postMessage)
// ============================================================================

export const PAGE_MESSAGE_TYPE = {
  EVENT_CAPTURED: "DL_EVENT_CAPTURED",
  CONTAINERS_DETECTED: "DL_CONTAINERS_DETECTED",
  INITIALIZED: "DL_INITIALIZED",
} as const;

export type PageMessageType =
  (typeof PAGE_MESSAGE_TYPE)[keyof typeof PAGE_MESSAGE_TYPE];

export interface PageEventCapturedPayload {
  readonly id: string;
  readonly timestamp: number;
  readonly url: string;
  readonly eventName: string | null;
  readonly data: Record<string, unknown>;
  readonly containerIds: readonly string[];
  readonly sourceName: string;
  readonly index: number;
}

export interface PageContainersDetectedPayload {
  readonly containers: readonly GTMContainer[];
}

export interface PageInitializedPayload {
  readonly dataLayerNames: readonly string[];
  readonly existingEventsCount: number;
}

export type PageToContentMessage =
  | {
      readonly source: typeof MESSAGE_SOURCE;
      readonly type: typeof PAGE_MESSAGE_TYPE.EVENT_CAPTURED;
      readonly payload: PageEventCapturedPayload;
    }
  | {
      readonly source: typeof MESSAGE_SOURCE;
      readonly type: typeof PAGE_MESSAGE_TYPE.CONTAINERS_DETECTED;
      readonly payload: PageContainersDetectedPayload;
    }
  | {
      readonly source: typeof MESSAGE_SOURCE;
      readonly type: typeof PAGE_MESSAGE_TYPE.INITIALIZED;
      readonly payload: PageInitializedPayload;
    };

// ============================================================================
// Content Script → Service Worker (chrome.runtime.sendMessage)
// ============================================================================

export const CONTENT_MESSAGE_TYPE = {
  EVENT: "DL_EVENT",
  CONTAINERS: "DL_CONTAINERS",
  INIT: "DL_INIT",
} as const;

export type ContentMessageType =
  (typeof CONTENT_MESSAGE_TYPE)[keyof typeof CONTENT_MESSAGE_TYPE];

export type ContentToBackgroundMessage =
  | {
      readonly type: typeof CONTENT_MESSAGE_TYPE.EVENT;
      readonly payload: DataLayerEvent;
    }
  | {
      readonly type: typeof CONTENT_MESSAGE_TYPE.CONTAINERS;
      readonly payload: {
        readonly containers: readonly GTMContainer[];
      };
    }
  | {
      readonly type: typeof CONTENT_MESSAGE_TYPE.INIT;
      readonly payload: {
        readonly dataLayerNames: readonly string[];
        readonly existingEventsCount: number;
      };
    };

// ============================================================================
// Service Worker → DevTools Panel / Popup (port.postMessage streaming)
// ============================================================================

export const BACKGROUND_MESSAGE_TYPE = {
  NEW_EVENT: "NEW_EVENT",
  CONTAINERS_UPDATED: "CONTAINERS_UPDATED",
  TAB_STATE_RESET: "TAB_STATE_RESET",
  RECORDING_CHANGED: "RECORDING_CHANGED",
  EXTENSION_ENABLED_CHANGED: "EXTENSION_ENABLED_CHANGED",
} as const;

export type BackgroundMessageType =
  (typeof BACKGROUND_MESSAGE_TYPE)[keyof typeof BACKGROUND_MESSAGE_TYPE];

export const TAB_RESET_REASON = {
  NAVIGATION: "navigation",
  CLEARED: "cleared",
  TAB_CLOSED: "tab-closed",
} as const;

export type TabResetReason =
  (typeof TAB_RESET_REASON)[keyof typeof TAB_RESET_REASON];

export type BackgroundToClientMessage =
  | {
      readonly type: typeof BACKGROUND_MESSAGE_TYPE.NEW_EVENT;
      readonly payload: DataLayerEvent;
    }
  | {
      readonly type: typeof BACKGROUND_MESSAGE_TYPE.CONTAINERS_UPDATED;
      readonly payload: {
        readonly containers: readonly string[];
      };
    }
  | {
      readonly type: typeof BACKGROUND_MESSAGE_TYPE.TAB_STATE_RESET;
      readonly payload: {
        readonly tabId: number;
        readonly reason: TabResetReason;
      };
    }
  | {
      readonly type: typeof BACKGROUND_MESSAGE_TYPE.RECORDING_CHANGED;
      readonly payload: {
        readonly isRecording: boolean;
      };
    }
  | {
      readonly type: typeof BACKGROUND_MESSAGE_TYPE.EXTENSION_ENABLED_CHANGED;
      readonly payload: {
        readonly enabled: boolean;
      };
    };

// ============================================================================
// DevTools Panel / Popup → Service Worker (request/response)
// ============================================================================

export const CLIENT_REQUEST_TYPE = {
  GET_EVENTS: "GET_EVENTS",
  GET_CONTAINERS: "GET_CONTAINERS",
  CLEAR_EVENTS: "CLEAR_EVENTS",
  SET_RECORDING: "SET_RECORDING",
  GET_TAB_STATE: "GET_TAB_STATE",
  GET_SETTINGS: "GET_SETTINGS",
  UPDATE_SETTINGS: "UPDATE_SETTINGS",
} as const;

export type ClientRequestType =
  (typeof CLIENT_REQUEST_TYPE)[keyof typeof CLIENT_REQUEST_TYPE];

export type ClientToBackgroundRequest =
  | {
      readonly type: typeof CLIENT_REQUEST_TYPE.GET_EVENTS;
      readonly payload: { readonly tabId: number };
    }
  | {
      readonly type: typeof CLIENT_REQUEST_TYPE.GET_CONTAINERS;
      readonly payload: { readonly tabId: number };
    }
  | {
      readonly type: typeof CLIENT_REQUEST_TYPE.CLEAR_EVENTS;
      readonly payload: { readonly tabId: number };
    }
  | {
      readonly type: typeof CLIENT_REQUEST_TYPE.SET_RECORDING;
      readonly payload: { readonly tabId: number; readonly isRecording: boolean };
    }
  | {
      readonly type: typeof CLIENT_REQUEST_TYPE.GET_TAB_STATE;
      readonly payload: { readonly tabId: number };
    }
  | {
      readonly type: typeof CLIENT_REQUEST_TYPE.GET_SETTINGS;
    }
  | {
      readonly type: typeof CLIENT_REQUEST_TYPE.UPDATE_SETTINGS;
      readonly payload: Partial<UserSettings>;
    };

export const CLIENT_RESPONSE_TYPE = {
  EVENTS: "EVENTS",
  CONTAINERS: "CONTAINERS",
  TAB_STATE: "TAB_STATE",
  SETTINGS: "SETTINGS",
  OK: "OK",
  ERROR: "ERROR",
} as const;

export type ClientResponseType =
  (typeof CLIENT_RESPONSE_TYPE)[keyof typeof CLIENT_RESPONSE_TYPE];

export type ClientToBackgroundResponse =
  | {
      readonly type: typeof CLIENT_RESPONSE_TYPE.EVENTS;
      readonly payload: { readonly events: readonly DataLayerEvent[] };
    }
  | {
      readonly type: typeof CLIENT_RESPONSE_TYPE.CONTAINERS;
      readonly payload: { readonly containers: readonly string[] };
    }
  | {
      readonly type: typeof CLIENT_RESPONSE_TYPE.TAB_STATE;
      readonly payload: TabState | null;
    }
  | {
      readonly type: typeof CLIENT_RESPONSE_TYPE.SETTINGS;
      readonly payload: UserSettings;
    }
  | {
      readonly type: typeof CLIENT_RESPONSE_TYPE.OK;
    }
  | {
      readonly type: typeof CLIENT_RESPONSE_TYPE.ERROR;
      readonly payload: { readonly message: string };
    };

// ============================================================================
// Service Worker → Content Script (chrome.tabs.sendMessage)
// ============================================================================

export const BACKGROUND_TO_CONTENT_TYPE = {
  SET_ENABLED: "SET_ENABLED",
} as const;

export type BackgroundToContentMessage = {
  readonly type: typeof BACKGROUND_TO_CONTENT_TYPE.SET_ENABLED;
  readonly payload: { readonly enabled: boolean };
};
