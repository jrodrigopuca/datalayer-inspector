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
});
