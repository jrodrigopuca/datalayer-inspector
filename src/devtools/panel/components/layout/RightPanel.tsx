/**
 * RightPanel component - routes between different right panel views
 */

import { usePanelStore, RIGHT_PANEL_VIEW } from "../../store";
import { DetailView } from "../detail";
import { SchemaList, SchemaEditor, ValidationErrors } from "../schema";

export function RightPanel() {
  const rightPanelView = usePanelStore((s) => s.rightPanelView);

  switch (rightPanelView.type) {
    case RIGHT_PANEL_VIEW.EVENT_DETAIL:
      return <DetailView />;

    case RIGHT_PANEL_VIEW.SCHEMA_LIST:
      return <SchemaList />;

    case RIGHT_PANEL_VIEW.SCHEMA_EDITOR:
      return <SchemaEditor schemaId={rightPanelView.schemaId} />;

    case RIGHT_PANEL_VIEW.VALIDATION_ERRORS:
      return <ValidationErrors eventId={rightPanelView.eventId} />;

    default:
      return <DetailView />;
  }
}
