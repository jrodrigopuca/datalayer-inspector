/**
 * useConnection hook - manages connection with service worker
 *
 * Handles:
 * - Establishing port connection
 * - Reconnection on disconnect
 * - Message handling
 * - Initial state sync
 */

import { LIMITS } from "@shared/constants";
import { sendRequest } from "@shared/messaging/client";
import {
  BACKGROUND_MESSAGE_TYPE,
  type BackgroundToClientMessage,
  CLIENT_REQUEST_TYPE,
  CLIENT_RESPONSE_TYPE,
  PORT_NAME,
  STORAGE_WARNING_KIND,
  type UserSettings,
} from "@shared/types";
import { useEffect, useRef } from "react";
import { CONNECTION_STATE, usePanelStore } from "../store";

export function useConnection(): void {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const setConnectionState = usePanelStore((s) => s.setConnectionState);
  const setErrorMessage = usePanelStore((s) => s.setErrorMessage);
  const setWarningMessage = usePanelStore((s) => s.setWarningMessage);
  const setTabId = usePanelStore((s) => s.setTabId);
  const setEvents = usePanelStore((s) => s.setEvents);
  const addEvent = usePanelStore((s) => s.addEvent);
  const clearEvents = usePanelStore((s) => s.clearEvents);
  const setContainers = usePanelStore((s) => s.setContainers);
  const setIsRecording = usePanelStore((s) => s.setIsRecording);
  const updateSettings = usePanelStore((s) => s.updateSettings);
  const setSchemas = usePanelStore((s) => s.setSchemas);

  useEffect(() => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    setTabId(tabId);

    function connect(): void {
      setConnectionState(CONNECTION_STATE.CONNECTING);

      try {
        const port = chrome.runtime.connect({ name: PORT_NAME.DEVTOOLS_PANEL });
        portRef.current = port;

        // Send INIT message with tab ID
        port.postMessage({ type: "INIT", tabId });

        port.onMessage.addListener(handleMessage);
        port.onDisconnect.addListener(handleDisconnect);

        // Request initial state
        void requestInitialState(tabId);

        setConnectionState(CONNECTION_STATE.CONNECTED);
        reconnectAttemptsRef.current = 0;
      } catch (error) {
        console.error("[Strata] Connection failed:", error);
        setConnectionState(CONNECTION_STATE.ERROR);
        setErrorMessage("Failed to connect to service worker");
        scheduleReconnect();
      }
    }

    function handleMessage(message: BackgroundToClientMessage): void {
      switch (message.type) {
        case BACKGROUND_MESSAGE_TYPE.NEW_EVENT:
          addEvent(message.payload);
          break;

        case BACKGROUND_MESSAGE_TYPE.CONTAINERS_UPDATED:
          setContainers(message.payload.containers);
          break;

        case BACKGROUND_MESSAGE_TYPE.TAB_STATE_RESET:
          // Re-sync state from background - don't clear first to avoid flash of empty state
          // The requestInitialState will set the correct events from background
          setWarningMessage(null);
          void requestInitialState(tabId);
          break;

        case BACKGROUND_MESSAGE_TYPE.STORAGE_WARNING:
          setWarningMessage(message.payload.message);
          if (message.payload.kind === STORAGE_WARNING_KIND.PRUNED_BY_SIZE) {
            // The worker dropped events in memory too - mirror it
            void requestInitialState(tabId);
          }
          break;

        case BACKGROUND_MESSAGE_TYPE.RECORDING_CHANGED:
          setIsRecording(message.payload.isRecording);
          break;

        case BACKGROUND_MESSAGE_TYPE.EXTENSION_ENABLED_CHANGED:
          updateSettings({ enabled: message.payload.enabled });
          break;

        case BACKGROUND_MESSAGE_TYPE.SCHEMAS_CHANGED:
          // Authoritative list (own edits echo back and no-op)
          setSchemas(message.payload.schemas);
          break;
      }
    }

    function handleDisconnect(): void {
      // Reading lastError marks it as handled (avoids
      // "Unchecked runtime.lastError" noise in the console)
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        console.debug("[Strata] Port disconnected:", lastError.message);
      }

      portRef.current = null;
      setConnectionState(CONNECTION_STATE.DISCONNECTED);
      scheduleReconnect();
    }

    function scheduleReconnect(): void {
      if (reconnectAttemptsRef.current >= LIMITS.MAX_RECONNECT_ATTEMPTS) {
        setConnectionState(CONNECTION_STATE.ERROR);
        setErrorMessage("Max reconnection attempts reached");
        return;
      }

      reconnectAttemptsRef.current++;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, LIMITS.RECONNECT_DELAY);
    }

    async function requestInitialState(
      tabId: number,
      attempt = 0
    ): Promise<void> {
      try {
        // Request tab state
        const stateResponse = await sendRequest({
          type: CLIENT_REQUEST_TYPE.GET_TAB_STATE,
          payload: { tabId },
        });

        if (
          stateResponse.type === CLIENT_RESPONSE_TYPE.TAB_STATE &&
          stateResponse.payload
        ) {
          setEvents(stateResponse.payload.events);
          setContainers(stateResponse.payload.containers);
          setIsRecording(stateResponse.payload.isRecording);
        }

        // Request settings (including enabled state)
        const settingsResponse = await sendRequest({
          type: CLIENT_REQUEST_TYPE.GET_SETTINGS,
        });

        if (settingsResponse.type === CLIENT_RESPONSE_TYPE.SETTINGS) {
          updateSettings(settingsResponse.payload);
        }

        // Request schemas (global, owned by the service worker)
        const schemasResponse = await sendRequest({
          type: CLIENT_REQUEST_TYPE.GET_SCHEMAS,
        });

        if (schemasResponse.type === CLIENT_RESPONSE_TYPE.SCHEMAS) {
          setSchemas(schemasResponse.payload.schemas);
        }
      } catch (error) {
        // The service worker may still be starting up - retry briefly
        if (attempt < 2) {
          setTimeout(() => {
            void requestInitialState(tabId, attempt + 1);
          }, 500);
          return;
        }
        console.error("[Strata] Failed to fetch initial state:", error);
        setErrorMessage("Could not reach the extension service worker");
      }
    }

    // Start connection
    connect();

    // Cleanup
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, [
    setConnectionState,
    setErrorMessage,
    setWarningMessage,
    setTabId,
    setEvents,
    addEvent,
    clearEvents,
    setContainers,
    setIsRecording,
    updateSettings,
    setSchemas,
  ]);
}

/**
 * Hook to send commands to service worker
 */
export function useCommands(): {
  clearEvents: () => Promise<void>;
  toggleRecording: () => Promise<void>;
  toggleEnabled: () => Promise<void>;
  saveSettings: (partial: Partial<UserSettings>) => Promise<void>;
} {
  const tabId = usePanelStore((s) => s.tabId);
  const isRecording = usePanelStore((s) => s.isRecording);
  const settings = usePanelStore((s) => s.settings);
  const updateSettings = usePanelStore((s) => s.updateSettings);

  async function clearEvents(): Promise<void> {
    if (tabId === null) return;

    await sendRequest({
      type: CLIENT_REQUEST_TYPE.CLEAR_EVENTS,
      payload: { tabId },
    });
  }

  async function toggleRecording(): Promise<void> {
    if (tabId === null) return;

    await sendRequest({
      type: CLIENT_REQUEST_TYPE.SET_RECORDING,
      payload: { tabId, isRecording: !isRecording },
    });
  }

  async function toggleEnabled(): Promise<void> {
    const newEnabled = !settings.enabled;
    updateSettings({ enabled: newEnabled });

    await sendRequest({
      type: CLIENT_REQUEST_TYPE.UPDATE_SETTINGS,
      payload: { enabled: newEnabled },
    });
  }

  async function saveSettings(partial: Partial<UserSettings>): Promise<void> {
    // Optimistic local update; the service worker persists to sync storage
    updateSettings(partial);

    await sendRequest({
      type: CLIENT_REQUEST_TYPE.UPDATE_SETTINGS,
      payload: partial,
    });
  }

  return { clearEvents, toggleRecording, toggleEnabled, saveSettings };
}
