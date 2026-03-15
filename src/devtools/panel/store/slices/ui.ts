/**
 * UI slice - manages panel UI state
 */

import type { StateCreator } from "zustand";

/** View mode for event detail panel */
export const VIEW_MODE = {
  TREE: "tree",
  RAW: "raw",
} as const;

export type ViewMode = (typeof VIEW_MODE)[keyof typeof VIEW_MODE];

/** Connection state with service worker */
export const CONNECTION_STATE = {
  CONNECTING: "connecting",
  CONNECTED: "connected",
  DISCONNECTED: "disconnected",
  ERROR: "error",
} as const;

export type ConnectionState =
  (typeof CONNECTION_STATE)[keyof typeof CONNECTION_STATE];

/** Right panel view types */
export const RIGHT_PANEL_VIEW = {
  EVENT_DETAIL: "event-detail",
  SCHEMA_LIST: "schema-list",
  SCHEMA_EDITOR: "schema-editor",
  VALIDATION_ERRORS: "validation-errors",
} as const;

export type RightPanelViewType =
  (typeof RIGHT_PANEL_VIEW)[keyof typeof RIGHT_PANEL_VIEW];

/** Right panel view state */
export type RightPanelView =
  | { type: typeof RIGHT_PANEL_VIEW.EVENT_DETAIL }
  | { type: typeof RIGHT_PANEL_VIEW.SCHEMA_LIST }
  | { type: typeof RIGHT_PANEL_VIEW.SCHEMA_EDITOR; schemaId: string | null }
  | { type: typeof RIGHT_PANEL_VIEW.VALIDATION_ERRORS; eventId: string };

export interface UISlice {
  /** Current view mode for detail panel */
  viewMode: ViewMode;
  /** Service worker connection state */
  connectionState: ConnectionState;
  /** Whether recording is active */
  isRecording: boolean;
  /** Search query */
  searchQuery: string;
  /** Active filter (event type) */
  activeFilter: string | null;
  /** Whether auto-scroll is enabled */
  autoScroll: boolean;
  /** Error message if any */
  errorMessage: string | null;
  /** Current tab ID */
  tabId: number | null;
  /** JSON tree expanded paths (for detail view) */
  expandedPaths: Set<string>;
  /** Current right panel view */
  rightPanelView: RightPanelView;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setConnectionState: (state: ConnectionState) => void;
  setIsRecording: (isRecording: boolean) => void;
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: string | null) => void;
  setAutoScroll: (enabled: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  setTabId: (tabId: number | null) => void;
  togglePath: (path: string) => void;
  expandPath: (path: string) => void;
  collapsePath: (path: string) => void;
  resetExpandedPaths: () => void;
  setRightPanelView: (view: RightPanelView) => void;
  showEventDetail: () => void;
  showSchemaList: () => void;
  showSchemaEditor: (schemaId: string | null) => void;
  showValidationErrors: (eventId: string) => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  viewMode: VIEW_MODE.TREE,
  connectionState: CONNECTION_STATE.CONNECTING,
  isRecording: true,
  searchQuery: "",
  activeFilter: null,
  autoScroll: true,
  errorMessage: null,
  tabId: null,
  expandedPaths: new Set(),
  rightPanelView: { type: RIGHT_PANEL_VIEW.EVENT_DETAIL },

  setViewMode: (viewMode) => set({ viewMode }),

  setConnectionState: (connectionState) => set({ connectionState }),

  setIsRecording: (isRecording) => set({ isRecording }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setActiveFilter: (activeFilter) => set({ activeFilter }),

  setAutoScroll: (autoScroll) => set({ autoScroll }),

  setErrorMessage: (errorMessage) => set({ errorMessage }),

  setTabId: (tabId) => set({ tabId }),

  togglePath: (path) =>
    set((state) => {
      const newPaths = new Set(state.expandedPaths);
      if (newPaths.has(path)) {
        newPaths.delete(path);
      } else {
        newPaths.add(path);
      }
      return { expandedPaths: newPaths };
    }),

  expandPath: (path) =>
    set((state) => {
      const newPaths = new Set(state.expandedPaths);
      newPaths.add(path);
      return { expandedPaths: newPaths };
    }),

  collapsePath: (path) =>
    set((state) => {
      const newPaths = new Set(state.expandedPaths);
      newPaths.delete(path);
      return { expandedPaths: newPaths };
    }),

  resetExpandedPaths: () => set({ expandedPaths: new Set() }),

  setRightPanelView: (rightPanelView) => set({ rightPanelView }),

  showEventDetail: () =>
    set({ rightPanelView: { type: RIGHT_PANEL_VIEW.EVENT_DETAIL } }),

  showSchemaList: () =>
    set({ rightPanelView: { type: RIGHT_PANEL_VIEW.SCHEMA_LIST } }),

  showSchemaEditor: (schemaId) =>
    set({
      rightPanelView: { type: RIGHT_PANEL_VIEW.SCHEMA_EDITOR, schemaId },
    }),

  showValidationErrors: (eventId) =>
    set({
      rightPanelView: { type: RIGHT_PANEL_VIEW.VALIDATION_ERRORS, eventId },
    }),
});
