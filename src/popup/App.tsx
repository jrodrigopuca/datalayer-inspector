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

export default function App() {
  const [state, setState] = useState<PopupState>(POPUP_STATE.LOADING);
  const [tabState, setTabState] = useState<TabState | null>(null);
  const [tabId, setTabId] = useState<number | null>(null);

  useEffect(() => {
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

  // Loading state
  if (state === POPUP_STATE.LOADING) {
    return (
      <div className="p-4 text-center">
        <div className="text-sm text-gray-400">Loading...</div>
      </div>
    );
  }

  // No tab state
  if (state === POPUP_STATE.NO_TAB) {
    return (
      <div className="p-4 text-center">
        <div className="text-sm text-gray-400">No active tab</div>
      </div>
    );
  }

  // No dataLayer detected
  if (state === POPUP_STATE.NO_DATALAYER || !tabState) {
    return (
      <div className="p-4 text-center">
        <div className="text-sm text-gray-400">No dataLayer detected</div>
        <div className="text-xs text-gray-500 mt-1">
          Navigate to a page with GTM installed
        </div>
      </div>
    );
  }

  // Ready state
  return (
    <div className="min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-panel-surface border-b border-panel-border">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              tabState.isRecording ? "bg-red-500 animate-pulse" : "bg-gray-500"
            }`}
          />
          <span className="text-sm font-medium">Strata</span>
        </div>
        <span className="text-2xs text-gray-500">
          {tabState.isRecording ? "Recording" : "Paused"}
        </span>
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
    </div>
  );
}
