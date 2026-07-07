/**
 * Slices index - re-exports all slices
 */

export { createEventsSlice, type EventsSlice } from "./events";
export { createSchemasSlice, type SchemasSlice } from "./schemas";
export { createSettingsSlice, type SettingsSlice } from "./settings";
export {
  CONNECTION_STATE,
  type ConnectionState,
  createUISlice,
  MODAL_TYPE,
  type ModalType,
  RIGHT_PANEL_VIEW,
  type RightPanelView,
  type RightPanelViewType,
  type UISlice,
  VIEW_MODE,
  type ViewMode,
} from "./ui";
