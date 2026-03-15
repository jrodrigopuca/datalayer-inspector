/**
 * DevTools Panel App
 *
 * Main application component for the DevTools panel
 */

import { useConnection, useKeyboard } from "./hooks";
import { usePanelStore, MODAL_TYPE } from "./store";
import {
  Toolbar,
  SplitPane,
  StatusBar,
  EventList,
  RightPanel,
  SearchBar,
  ExportTestModal,
  ExportEvidenceModal,
} from "./components";

export default function App() {
  // Initialize connection with service worker
  useConnection();

  // Initialize keyboard shortcuts
  useKeyboard();

  const activeModal = usePanelStore((s) => s.activeModal);
  const closeModal = usePanelStore((s) => s.closeModal);
  const events = usePanelStore((s) => s.events);

  return (
    <div className="h-screen flex flex-col bg-panel-bg text-gray-100">
      {/* Top toolbar */}
      <Toolbar />

      {/* Search bar */}
      <SearchBar />

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <SplitPane
          left={<EventList />}
          right={<RightPanel />}
          defaultLeftWidth={300}
          minLeftWidth={200}
          maxLeftWidth={500}
        />
      </div>

      {/* Bottom status bar */}
      <StatusBar />

      {/* Modals */}
      {activeModal === MODAL_TYPE.EXPORT_TEST && (
        <ExportTestModal events={events} onClose={closeModal} />
      )}
      {activeModal === MODAL_TYPE.EXPORT_EVIDENCE && (
        <ExportEvidenceModal events={events} onClose={closeModal} />
      )}
    </div>
  );
}
