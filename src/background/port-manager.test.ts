import { PORT_NAME } from "@shared/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  broadcastToAll,
  broadcastToTab,
  clearAllPorts,
  getPortCount,
  getTotalPortCount,
  hasConnectedPorts,
  registerPort,
} from "./port-manager";

interface FakePort {
  port: chrome.runtime.Port;
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: () => void;
}

function createFakePort(name: string): FakePort {
  const disconnectListeners: Array<() => void> = [];
  const postMessage = vi.fn();

  const port = {
    name,
    postMessage,
    disconnect: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    onDisconnect: {
      addListener: vi.fn((listener: () => void) => {
        disconnectListeners.push(listener);
      }),
      removeListener: vi.fn(),
    },
  } as unknown as chrome.runtime.Port;

  return {
    port,
    postMessage,
    disconnect: () => {
      for (const listener of disconnectListeners) listener();
    },
  };
}

const MESSAGE = {
  type: "RECORDING_CHANGED",
  payload: { isRecording: false },
} as const;

describe("port-manager", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearAllPorts();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe("registerPort", () => {
    it("registers a devtools port for a tab", () => {
      const { port } = createFakePort(PORT_NAME.DEVTOOLS_PANEL);

      registerPort(port, 1);

      expect(hasConnectedPorts(1)).toBe(true);
      expect(getPortCount(1)).toBe(1);
      expect(getTotalPortCount()).toBe(1);
    });

    it("allows several ports on the same tab (devtools + popup)", () => {
      registerPort(createFakePort(PORT_NAME.DEVTOOLS_PANEL).port, 1);
      registerPort(createFakePort(PORT_NAME.POPUP).port, 1);

      expect(getPortCount(1)).toBe(2);
      expect(getTotalPortCount()).toBe(2);
    });

    it("rejects ports with an unknown name", () => {
      const { port } = createFakePort("evil-port");

      registerPort(port, 1);

      expect(hasConnectedPorts(1)).toBe(false);
      expect(getTotalPortCount()).toBe(0);
      expect(warnSpy).toHaveBeenCalledOnce();
    });

    it("unregisters the port when it disconnects", () => {
      const devtools = createFakePort(PORT_NAME.DEVTOOLS_PANEL);
      const popup = createFakePort(PORT_NAME.POPUP);
      registerPort(devtools.port, 1);
      registerPort(popup.port, 1);

      devtools.disconnect();

      expect(getPortCount(1)).toBe(1);
      expect(getTotalPortCount()).toBe(1);

      popup.disconnect();

      expect(hasConnectedPorts(1)).toBe(false);
      expect(getPortCount(1)).toBe(0);
      expect(getTotalPortCount()).toBe(0);
    });
  });

  describe("broadcastToTab", () => {
    it("delivers only to the ports of that tab", () => {
      const tab1 = createFakePort(PORT_NAME.DEVTOOLS_PANEL);
      const tab2 = createFakePort(PORT_NAME.DEVTOOLS_PANEL);
      registerPort(tab1.port, 1);
      registerPort(tab2.port, 2);

      broadcastToTab(1, MESSAGE);

      expect(tab1.postMessage).toHaveBeenCalledWith(MESSAGE);
      expect(tab2.postMessage).not.toHaveBeenCalled();
    });

    it("is a no-op for tabs without ports", () => {
      expect(() => broadcastToTab(99, MESSAGE)).not.toThrow();
    });

    it("keeps delivering when one port throws", () => {
      const broken = createFakePort(PORT_NAME.DEVTOOLS_PANEL);
      const healthy = createFakePort(PORT_NAME.POPUP);
      broken.postMessage.mockImplementation(() => {
        throw new Error("Attempting to use a disconnected port object");
      });
      registerPort(broken.port, 1);
      registerPort(healthy.port, 1);

      expect(() => broadcastToTab(1, MESSAGE)).not.toThrow();
      expect(healthy.postMessage).toHaveBeenCalledWith(MESSAGE);
    });
  });

  describe("broadcastToAll", () => {
    it("delivers to every connected port regardless of tab", () => {
      const a = createFakePort(PORT_NAME.DEVTOOLS_PANEL);
      const b = createFakePort(PORT_NAME.POPUP);
      const c = createFakePort(PORT_NAME.DEVTOOLS_PANEL);
      registerPort(a.port, 1);
      registerPort(b.port, 1);
      registerPort(c.port, 2);

      broadcastToAll(MESSAGE);

      expect(a.postMessage).toHaveBeenCalledWith(MESSAGE);
      expect(b.postMessage).toHaveBeenCalledWith(MESSAGE);
      expect(c.postMessage).toHaveBeenCalledWith(MESSAGE);
    });

    it("does not deliver to disconnected ports", () => {
      const gone = createFakePort(PORT_NAME.DEVTOOLS_PANEL);
      registerPort(gone.port, 1);
      gone.disconnect();

      broadcastToAll(MESSAGE);

      expect(gone.postMessage).not.toHaveBeenCalled();
    });
  });
});
