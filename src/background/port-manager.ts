/**
 * Service Worker - Port Manager
 *
 * Manages long-lived connections with DevTools panels and popups.
 * Handles broadcasting events to connected clients.
 */

import { PORT_NAME, type PortName, type BackgroundToClientMessage } from "@shared/types";

interface ConnectedPort {
  port: chrome.runtime.Port;
  tabId: number;
  type: PortName;
}

/**
 * Connected ports by tab ID
 * A tab can have multiple ports (DevTools + Popup)
 */
const portsByTab = new Map<number, ConnectedPort[]>();

/**
 * All connected ports for quick iteration
 */
const allPorts = new Set<ConnectedPort>();

/**
 * Register a new port connection
 */
export function registerPort(port: chrome.runtime.Port, tabId: number): void {
  const portType = port.name as PortName;

  // Validate port name
  if (!Object.values(PORT_NAME).includes(portType)) {
    console.warn(`[Strata] Unknown port name: ${port.name}`);
    return;
  }

  const connectedPort: ConnectedPort = {
    port,
    tabId,
    type: portType,
  };

  // Add to tab's ports
  const tabPorts = portsByTab.get(tabId) ?? [];
  tabPorts.push(connectedPort);
  portsByTab.set(tabId, tabPorts);

  // Add to all ports
  allPorts.add(connectedPort);

  // Handle disconnect
  port.onDisconnect.addListener(() => {
    unregisterPort(connectedPort);
  });
}

/**
 * Unregister a port (on disconnect)
 */
function unregisterPort(connectedPort: ConnectedPort): void {
  // Remove from tab's ports
  const tabPorts = portsByTab.get(connectedPort.tabId);
  if (tabPorts) {
    const index = tabPorts.indexOf(connectedPort);
    if (index !== -1) {
      tabPorts.splice(index, 1);
    }
    if (tabPorts.length === 0) {
      portsByTab.delete(connectedPort.tabId);
    }
  }

  // Remove from all ports
  allPorts.delete(connectedPort);
}

/**
 * Broadcast message to all ports for a specific tab
 */
export function broadcastToTab(
  tabId: number,
  message: BackgroundToClientMessage
): void {
  const tabPorts = portsByTab.get(tabId);
  if (!tabPorts) return;

  for (const connectedPort of tabPorts) {
    try {
      connectedPort.port.postMessage(message);
    } catch {
      // Port might be disconnected, ignore
    }
  }
}

/**
 * Broadcast message to all connected ports
 */
export function broadcastToAll(message: BackgroundToClientMessage): void {
  for (const connectedPort of allPorts) {
    try {
      connectedPort.port.postMessage(message);
    } catch {
      // Port might be disconnected, ignore
    }
  }
}

/**
 * Check if a tab has any connected ports
 */
export function hasConnectedPorts(tabId: number): boolean {
  const tabPorts = portsByTab.get(tabId);
  return tabPorts !== undefined && tabPorts.length > 0;
}

/**
 * Get count of connected ports for a tab
 */
export function getPortCount(tabId: number): number {
  return portsByTab.get(tabId)?.length ?? 0;
}

/**
 * Get total connected ports count
 */
export function getTotalPortCount(): number {
  return allPorts.size;
}

/**
 * Clear all ports (for testing)
 */
export function clearAllPorts(): void {
  allPorts.clear();
  portsByTab.clear();
}
