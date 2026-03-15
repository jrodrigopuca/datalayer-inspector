/**
 * Main store - combines all slices
 *
 * Following Zustand 5 patterns with slice composition
 */

import { create } from "zustand";

import {
  createEventsSlice,
  createUISlice,
  createSettingsSlice,
  createSchemasSlice,
  type EventsSlice,
  type UISlice,
  type SettingsSlice,
  type SchemasSlice,
} from "./slices";

export type PanelStore = EventsSlice & UISlice & SettingsSlice & SchemasSlice;

export const usePanelStore = create<PanelStore>()((...args) => ({
  ...createEventsSlice(...args),
  ...createUISlice(...args),
  ...createSettingsSlice(...args),
  ...createSchemasSlice(...args),
}));

// Export type for use with useShallow
export type { EventsSlice, UISlice, SettingsSlice, SchemasSlice };

// Re-export constants
export { VIEW_MODE, CONNECTION_STATE, RIGHT_PANEL_VIEW } from "./slices";
export type {
  ViewMode,
  ConnectionState,
  RightPanelView,
  RightPanelViewType,
} from "./slices";
