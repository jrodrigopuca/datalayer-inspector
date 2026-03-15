/**
 * useConnection hook - manages connection with service worker
 *
 * Handles:
 * - Establishing port connection
 * - Reconnection on disconnect
 * - Message handling
 * - Initial state sync
 */

import { useEffect, useRef } from "react";
import { usePanelStore, CONNECTION_STATE } from "../store";
import {
  PORT_NAME,
  BACKGROUND_MESSAGE_TYPE,
  CLIENT_REQUEST_TYPE,
  CLIENT_RESPONSE_TYPE,
  type BackgroundToClientMessage,
  type ClientToBackgroundRequest,
  type ClientToBackgroundResponse,
} from "@shared/types";
import { LIMITS } from "@shared/constants";

export function useConnection(): void {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const setConnectionState = usePanelStore((s) => s.setConnectionState);
  const setErrorMessage = usePanelStore((s) => s.setErrorMessage);
  const setTabId = usePanelStore((s) => s.setTabId);
  const setEvents = usePanelStore((s) => s.setEvents);
  const addEvent = usePanelStore((s) => s.addEvent);
  const clearEvents = usePanelStore((s) => s.clearEvents);
  const setContainers = usePanelStore((s) => s.setContainers);
  const setIsRecording = usePanelStore((s) => s.setIsRecording);

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
        requestInitialState(tabId);

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
          clearEvents();
          break;

        case BACKGROUND_MESSAGE_TYPE.RECORDING_CHANGED:
          setIsRecording(message.payload.isRecording);
          break;
      }
    }

    function handleDisconnect(): void {
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

    async function requestInitialState(tabId: number): Promise<void> {
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
      } catch (error) {
        console.error("[Strata] Failed to fetch initial state:", error);
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
    setTabId,
    setEvents,
    addEvent,
    clearEvents,
    setContainers,
    setIsRecording,
  ]);
}

/**
 * Hook to send commands to service worker
 */
export function useCommands(): {
  clearEvents: () => Promise<void>;
  toggleRecording: () => Promise<void>;
} {
  const tabId = usePanelStore((s) => s.tabId);
  const isRecording = usePanelStore((s) => s.isRecording);

  async function sendCommand(
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

  async function clearEvents(): Promise<void> {
    if (tabId === null) return;

    await sendCommand({
      type: CLIENT_REQUEST_TYPE.CLEAR_EVENTS,
      payload: { tabId },
    });
  }

  async function toggleRecording(): Promise<void> {
    if (tabId === null) return;

    await sendCommand({
      type: CLIENT_REQUEST_TYPE.SET_RECORDING,
      payload: { tabId, isRecording: !isRecording },
    });
  }

  return { clearEvents, toggleRecording };
}
