/**
 * Main store - combines all slices
 *
 * Following Zustand 5 patterns with slice composition
 */

import { create } from "zustand";

import {
  createEventsSlice,
  createSchemasSlice,
  createSettingsSlice,
  createUISlice,
  type EventsSlice,
  type SchemasSlice,
  type SettingsSlice,
  type UISlice,
} from "./slices";

export type PanelStore = EventsSlice & UISlice & SettingsSlice & SchemasSlice;

export const usePanelStore = create<PanelStore>()((...args) => ({
  ...createEventsSlice(...args),
  ...createUISlice(...args),
  ...createSettingsSlice(...args),
  ...createSchemasSlice(...args),
}));

export type {
  ConnectionState,
  ModalType,
  RightPanelView,
  RightPanelViewType,
  ViewMode,
} from "./slices";

// Re-export constants
export {
  CONNECTION_STATE,
  MODAL_TYPE,
  RIGHT_PANEL_VIEW,
  VIEW_MODE,
} from "./slices";
// Export type for use with useShallow
export type { EventsSlice, SchemasSlice, SettingsSlice, UISlice };
