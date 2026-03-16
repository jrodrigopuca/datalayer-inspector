/**
 * Popup App
 *
 * Quick summary view accessible from browser toolbar
 */

import { useState, useEffect } from "react";
import { EventSummary, ContainerList, QuickActions } from "./components";
import {
  PORT_NAME,
  CLIENT_REQUEST_TYPE,
  CLIENT_RESPONSE_TYPE,
  BACKGROUND_MESSAGE_TYPE,
  type TabState,
  type BackgroundToClientMessage,
  type ClientToBackgroundRequest,
  type ClientToBackgroundResponse,
} from "@shared/types";

const POPUP_STATE = {
  LOADING: "loading",
  NO_TAB: "no-tab",
  NO_DATALAYER: "no-datalayer",
  READY: "ready",
} as const;

type PopupState = (typeof POPUP_STATE)[keyof typeof POPUP_STATE];

// Get version from manifest
function getExtensionVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return "0.0.0";
  }
}

export default function App() {
  const [state, setState] = useState<PopupState>(POPUP_STATE.LOADING);
  const [tabState, setTabState] = useState<TabState | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);

  useEffect(() => {
    // Load settings first
    loadSettings();

    // Get current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        setState(POPUP_STATE.NO_TAB);
        return;
      }

      setTabId(tab.id);
      connectToServiceWorker(tab.id);
    });
  }, []);

  async function loadSettings(): Promise<void> {
    try {
      const response = await sendRequest({
        type: CLIENT_REQUEST_TYPE.GET_SETTINGS,
      });
      if (response.type === CLIENT_RESPONSE_TYPE.SETTINGS) {
        setIsEnabled(response.payload.enabled);
      }
    } catch {
      // Ignore, use default
    }
  }

  function connectToServiceWorker(tabId: number): void {
    try {
      const port = chrome.runtime.connect({ name: PORT_NAME.POPUP });

      // Send init message
      port.postMessage({ type: "INIT", tabId });

      // Listen for updates
      port.onMessage.addListener((message: BackgroundToClientMessage) => {
        switch (message.type) {
          case BACKGROUND_MESSAGE_TYPE.NEW_EVENT:
            setTabState((prev) =>
              prev
                ? { ...prev, events: [...prev.events, message.payload] }
                : null
            );
            break;

          case BACKGROUND_MESSAGE_TYPE.TAB_STATE_RESET:
            setTabState((prev) => (prev ? { ...prev, events: [] } : null));
            break;

          case BACKGROUND_MESSAGE_TYPE.RECORDING_CHANGED:
            setTabState((prev) =>
              prev
                ? { ...prev, isRecording: message.payload.isRecording }
                : null
            );
            break;

          case BACKGROUND_MESSAGE_TYPE.CONTAINERS_UPDATED:
            setTabState((prev) =>
              prev
                ? { ...prev, containers: message.payload.containers }
                : null
            );
            break;

          case BACKGROUND_MESSAGE_TYPE.EXTENSION_ENABLED_CHANGED:
            setIsEnabled(message.payload.enabled);
            break;
        }
      });

      // Request initial state
      requestTabState(tabId);
    } catch (error) {
      console.error("[Strata Popup] Connection failed:", error);
      setState(POPUP_STATE.NO_DATALAYER);
    }
  }

  async function requestTabState(tabId: number): Promise<void> {
    try {
      const response = await sendRequest({
        type: CLIENT_REQUEST_TYPE.GET_TAB_STATE,
        payload: { tabId },
      });

      if (response.type === CLIENT_RESPONSE_TYPE.TAB_STATE) {
        if (response.payload) {
          setTabState(response.payload);
          setState(POPUP_STATE.READY);
        } else {
          setState(POPUP_STATE.NO_DATALAYER);
        }
      }
    } catch (error) {
      console.error("[Strata Popup] Failed to get tab state:", error);
      setState(POPUP_STATE.NO_DATALAYER);
    }
  }

  async function sendRequest(
    request: ClientToBackgroundRequest
  ): Promise<ClientToBackgroundResponse> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(request, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  async function handleClear(): Promise<void> {
    if (!tabId) return;

    await sendRequest({
      type: CLIENT_REQUEST_TYPE.CLEAR_EVENTS,
      payload: { tabId },
    });

    setTabState((prev) => (prev ? { ...prev, events: [] } : null));
  }

  async function handleToggleRecording(): Promise<void> {
    if (!tabId || !tabState) return;

    await sendRequest({
      type: CLIENT_REQUEST_TYPE.SET_RECORDING,
      payload: { tabId, isRecording: !tabState.isRecording },
    });

    setTabState((prev) =>
      prev ? { ...prev, isRecording: !prev.isRecording } : null
    );
  }

  async function handleToggleEnabled(): Promise<void> {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);

    await sendRequest({
      type: CLIENT_REQUEST_TYPE.UPDATE_SETTINGS,
      payload: { enabled: newEnabled },
    });
  }

  // Header with global toggle (always visible)
  const header = (
    <div className="flex items-center justify-between px-3 py-2 bg-panel-surface border-b border-panel-border">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Strata</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={isEnabled}
        aria-label={isEnabled ? "Disable extension" : "Enable extension"}
        onClick={handleToggleEnabled}
        className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
          isEnabled ? "bg-brand-primary" : "bg-gray-600"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            isEnabled ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );

  // Footer with version (always visible)
  const footer = (
    <div className="px-3 py-1 text-2xs text-gray-600 text-center border-t border-panel-border">
      v{getExtensionVersion()}
    </div>
  );

  // Loading state
  if (state === POPUP_STATE.LOADING) {
    return (
      <div className="min-h-0">
        {header}
        <div className="p-4 text-center">
          <div className="text-sm text-gray-400">Loading...</div>
        </div>
        {footer}
      </div>
    );
  }

  // No tab state
  if (state === POPUP_STATE.NO_TAB) {
    return (
      <div className="min-h-0">
        {header}
        <div className="p-4 text-center">
          <div className="text-sm text-gray-400">No active tab</div>
        </div>
        {footer}
      </div>
    );
  }

  // Extension disabled
  if (!isEnabled) {
    return (
      <div className="min-h-0">
        {header}
        <div className="p-4 text-center">
          <div className="text-sm text-gray-400">Extension disabled</div>
          <div className="text-xs text-gray-500 mt-1">
            Toggle the switch above to enable
          </div>
        </div>
        {footer}
      </div>
    );
  }

  // No dataLayer detected
  if (state === POPUP_STATE.NO_DATALAYER || !tabState) {
    return (
      <div className="min-h-0">
        {header}
        <div className="p-4 text-center">
          <div className="text-sm text-gray-400">No dataLayer detected</div>
          <div className="text-xs text-gray-500 mt-1">
            Navigate to a page with GTM installed
          </div>
        </div>
        {footer}
      </div>
    );
  }

  // Ready state
  return (
    <div className="min-h-0">
      {/* Header with recording indicator */}
      <div className="flex items-center justify-between px-3 py-2 bg-panel-surface border-b border-panel-border">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              tabState.isRecording ? "bg-red-500 animate-pulse" : "bg-gray-500"
            }`}
          />
          <span className="text-sm font-medium">Strata</span>
          <span className="text-2xs text-gray-500">
            {tabState.isRecording ? "Recording" : "Paused"}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          aria-label={isEnabled ? "Disable extension" : "Enable extension"}
          onClick={handleToggleEnabled}
          className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary ${
            isEnabled ? "bg-brand-primary" : "bg-gray-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
              isEnabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Event summary */}
      <EventSummary events={tabState.events} />

      {/* Container list */}
      <ContainerList containers={tabState.containers} />

      {/* Quick actions */}
      <QuickActions
        onClear={handleClear}
        onToggleRecording={handleToggleRecording}
        isRecording={tabState.isRecording}
      />

      {/* Footer with version */}
      {footer}
    </div>
  );
}
