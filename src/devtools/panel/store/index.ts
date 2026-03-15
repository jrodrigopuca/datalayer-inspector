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
  type EventsSlice,
  type UISlice,
  type SettingsSlice,
} from "./slices";

export type PanelStore = EventsSlice & UISlice & SettingsSlice;

export const usePanelStore = create<PanelStore>()((...args) => ({
  ...createEventsSlice(...args),
  ...createUISlice(...args),
  ...createSettingsSlice(...args),
}));

// Export type for use with useShallow
export type { EventsSlice, UISlice, SettingsSlice };

// Re-export constants
export { VIEW_MODE, CONNECTION_STATE } from "./slices";
export type { ViewMode, ConnectionState } from "./slices";
