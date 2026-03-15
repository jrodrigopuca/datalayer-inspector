# Strata — Technical Design

> Derivado de [SPEC.md](./SPEC.md) y [TEST-CASES.md](./TEST-CASES.md) — Marzo 2026

Este documento describe el diseño técnico de implementación: patrones, decisiones de arquitectura, flujos de datos, y estructura de código.

---

## Implementation Notes (Post Phase 1)

### Key Technical Decisions Made During Implementation

#### 1. Page Script Build Strategy

**Problem**: CRXJS generates ES modules by default, but Chrome throws MIME type errors when injecting page scripts as modules.

**Solution**: Separate Vite config (`vite.page-script.config.ts`) that builds page script as standalone IIFE:
- Output to `public/page-script.js` (pre-build)
- Main build copies to `dist/`
- Build command: `tsc && vite build --config vite.page-script.config.ts && vite build`

#### 2. EventList Simplification

**Problem**: Custom virtualization logic had height calculation bugs in DevTools context. `containerHeight` was 0, causing only 5 items (OVERSCAN) to render.

**Solution**: Removed virtualization entirely. React handles hundreds of items fine. If 1000+ events needed, add `@tanstack/virtual` later.

**Current implementation**: Simple `.map()` with native scroll:
```tsx
<div className="h-full overflow-auto">
  {events.map((event) => <EventItem key={event.id} ... />)}
</div>
```

#### 3. Full-Height Layout Chain

**Problem**: `h-full` on EventList didn't work because parent containers lacked explicit height.

**Solution**: Added to `globals.css`:
```css
html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
```

And `h-full` to SplitPane's left pane container.

#### 4. Event Badge Display

**Problem**: EventBadge was showing category name ("Custom", "GTM") instead of actual event name.

**Solution**: Badge now shows the real event name (`page_view`, `gtm.js`, `purchase`, etc.) with color-coding based on category.

### File Changes Summary

| File | Change |
|------|--------|
| `vite.page-script.config.ts` | New - IIFE build for page script |
| `package.json` | Updated build script |
| `src/styles/globals.css` | Added height: 100% chain |
| `src/devtools/panel/components/layout/SplitPane.tsx` | Added h-full to left pane |
| `src/devtools/panel/components/timeline/EventList.tsx` | Simplified, removed virtualization |
| `src/devtools/panel/components/timeline/EventItem.tsx` | Added data-event-id attribute |
| `src/devtools/panel/components/timeline/EventBadge.tsx` | Fixed to show event name |

---

## Índice

1. [Principios de Diseño](#1-principios-de-diseño)
2. [Arquitectura de Capas](#2-arquitectura-de-capas)
3. [Page Script — Diseño Detallado](#3-page-script--diseño-detallado)
4. [Content Script — Diseño Detallado](#4-content-script--diseño-detallado)
5. [Service Worker — Diseño Detallado](#5-service-worker--diseño-detallado)
6. [DevTools Panel — Diseño Detallado](#6-devtools-panel--diseño-detallado)
7. [Popup — Diseño Detallado](#7-popup--diseño-detallado)
8. [Sistema de Mensajes](#8-sistema-de-mensajes)
9. [Gestión de Estado](#9-gestión-de-estado)
10. [Persistencia](#10-persistencia)
11. [Decisiones de Diseño](#11-decisiones-de-diseño)
12. [Diagramas](#12-diagramas)
13. [Fase 2 — Diseño de Features](#13-fase-2--diseño-de-features)

---

## 1. Principios de Diseño

### 1.1 Principios Core

| Principio | Descripción | Implicación |
|-----------|-------------|-------------|
| **Zero Impact** | La extensión no debe afectar el funcionamiento de la página | Try/catch en todo el page script, no modificar window.dataLayer |
| **Fail Silent** | Errores internos no deben propagarse | Logging interno, nunca throw hacia la página |
| **Minimal Footprint** | Código mínimo en contextos críticos | Page script < 5KB, lógica pesada en panel |
| **Stateless Relay** | Content script sin estado | Solo retransmite, no procesa ni almacena |
| **Single Source of Truth** | Service Worker es la autoridad del estado | Panel y popup consultan, no almacenan |
| **Graceful Degradation** | Funcionar aunque partes fallen | Si SW duerme, reconectar; si storage falla, seguir en memoria |

### 1.2 Separación de Responsabilidades

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CAPTURA (Page Context)                       │
│  Page Script: Interceptar push, detectar containers, emitir eventos │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         RELAY (Isolated Context)                     │
│  Content Script: Filtrar mensajes, retransmitir a extension context │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      COORDINACIÓN (Extension Context)                │
│  Service Worker: Estado por tab, routing de mensajes, persistencia  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                        ┌───────────┴───────────┐
                        ▼                       ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────┐
│      PRESENTACIÓN (DevTools)     │ │      PRESENTACIÓN (Popup)       │
│  Panel: Timeline, JSON view,     │ │  Quick view: Contador, último   │
│  búsqueda, filtros               │ │  evento, containers             │
└─────────────────────────────────┘ └─────────────────────────────────┘
```

---

## 2. Arquitectura de Capas

### 2.1 Estructura de Directorios Detallada

```
src/
├── page/                          # CAPA: Captura
│   ├── index.ts                   # Entry point, bootstrap
│   ├── interceptor.ts             # Lógica de intercepción de push
│   ├── container-detector.ts      # Detección de GTM containers
│   └── message-emitter.ts         # Envío de postMessage
│
├── content/                       # CAPA: Relay
│   ├── index.ts                   # Entry point
│   ├── injector.ts                # Inyección del page script
│   └── relay.ts                   # Filtrado y retransmisión
│
├── background/                    # CAPA: Coordinación
│   ├── index.ts                   # Entry point, setup de listeners
│   ├── tab-manager.ts             # CRUD de TabState
│   ├── port-manager.ts            # Gestión de ports conectados
│   ├── message-handler.ts         # Router de mensajes entrantes
│   ├── storage.ts                 # Persistencia a chrome.storage
│   └── settings.ts                # Gestión de UserSettings
│
├── devtools/                      # CAPA: Presentación (DevTools)
│   ├── devtools.html              # Entry HTML para DevTools page
│   ├── devtools.ts                # Registro del panel
│   ├── panel.html                 # Shell HTML del panel
│   └── panel/                     # Aplicación React del panel
│       ├── main.tsx               # React entry point
│       ├── App.tsx                # Root component
│       ├── store/                 # Estado (Zustand)
│       │   ├── index.ts           # Store principal
│       │   ├── slices/            # Slices del store
│       │   │   ├── events.ts      # Estado de eventos
│       │   │   ├── ui.ts          # Estado de UI
│       │   │   └── settings.ts    # Settings del usuario
│       │   └── selectors.ts       # Selectores derivados
│       ├── hooks/                 # Custom hooks
│       │   ├── use-connection.ts  # Conexión con SW
│       │   ├── use-events.ts      # Acceso a eventos
│       │   ├── use-search.ts      # Lógica de búsqueda
│       │   └── use-keyboard.ts    # Keyboard shortcuts
│       ├── components/            # Componentes React
│       │   ├── layout/            # Layout components
│       │   │   ├── Toolbar.tsx
│       │   │   ├── SplitPane.tsx
│       │   │   └── StatusBar.tsx
│       │   ├── timeline/          # Event list
│       │   │   ├── EventList.tsx
│       │   │   ├── EventItem.tsx
│       │   │   └── EventBadge.tsx
│       │   ├── detail/            # Detail view
│       │   │   ├── DetailView.tsx
│       │   │   ├── JsonTreeView.tsx
│       │   │   ├── JsonRawView.tsx
│       │   │   ├── TreeNode.tsx
│       │   │   └── Breadcrumb.tsx
│       │   ├── search/            # Search & filter
│       │   │   ├── SearchBar.tsx
│       │   │   └── FilterDropdown.tsx
│       │   └── common/            # Shared components
│       │       ├── Button.tsx
│       │       ├── Badge.tsx
│       │       ├── Toast.tsx
│       │       └── Dialog.tsx
│       └── lib/                   # Utilidades del panel
│           ├── json-tree.ts       # Lógica de árbol JSON
│           ├── search.ts          # Motor de búsqueda
│           ├── copy.ts            # Clipboard utilities
│           └── format.ts          # Formateo de datos
│
├── popup/                         # CAPA: Presentación (Popup)
│   ├── popup.html
│   ├── main.tsx
│   ├── App.tsx
│   └── components/
│       ├── EventSummary.tsx
│       ├── ContainerList.tsx
│       └── QuickActions.tsx
│
├── shared/                        # COMPARTIDO: Contratos
│   ├── types/                     # Definiciones de tipos
│   │   ├── events.ts              # DataLayerEvent, TabState
│   │   ├── messages.ts            # Tipos de mensajes
│   │   ├── settings.ts            # UserSettings
│   │   └── index.ts               # Re-exports
│   ├── constants.ts               # MESSAGE_SOURCE, port names
│   ├── messages/                  # Factorías de mensajes
│   │   ├── page-to-content.ts
│   │   ├── content-to-background.ts
│   │   ├── background-to-client.ts
│   │   └── client-to-background.ts
│   └── validators/                # Type guards y validadores
│       └── message-validators.ts
│
└── assets/
    ├── icons/                     # Extension icons
    │   ├── icon-16.png
    │   ├── icon-32.png
    │   ├── icon-48.png
    │   └── icon-128.png
    └── styles/
        └── base.css               # Variables CSS, reset
```

### 2.2 Dependencias entre Módulos

```
┌─────────────────────────────────────────────────────────────────┐
│                        src/shared/                               │
│  (types, constants, messages, validators)                        │
│  ───────────────────────────────────────                         │
│  Dependencia de TODOS los módulos. Zero runtime deps.            │
└─────────────────────────────────────────────────────────────────┘
         ▲              ▲               ▲              ▲
         │              │               │              │
    ┌────┴────┐    ┌────┴────┐    ┌─────┴─────┐   ┌────┴────┐
    │  page/  │    │ content/│    │background/│   │devtools/│
    │         │    │         │    │           │   │ popup/  │
    └─────────┘    └─────────┘    └───────────┘   └─────────┘
         │              │               ▲              │
         │              │               │              │
         └──────────────┴───────────────┴──────────────┘
                    Runtime message flow
```

---

## 3. Page Script — Diseño Detallado

### 3.1 Responsabilidades

1. **Interceptar** `dataLayer.push()` sin romper funcionalidad original
2. **Detectar** containers GTM existentes
3. **Procesar** eventos pre-existentes en el array
4. **Emitir** eventos al content script via postMessage

### 3.2 Módulos

#### `interceptor.ts` — Core de Intercepción

```typescript
/**
 * Estrategia de intercepción:
 * 1. Guardar referencia al push original
 * 2. Reemplazar con wrapper que:
 *    a) Captura metadata
 *    b) Emite mensaje
 *    c) Llama al original
 * 3. Manejar dataLayer que no existe aún (Object.defineProperty)
 */

interface InterceptorState {
  interceptedArrays: WeakSet<unknown[]>;
  eventIndex: number;
  isInitialized: boolean;
}

// Singleton state (closure, no global)
const state: InterceptorState = {
  interceptedArrays: new WeakSet(),
  eventIndex: 0,
  isInitialized: false,
};

export function interceptDataLayer(
  arrayName: string,
  onEvent: (event: CapturedEvent) => void
): void {
  const win = window as Window & { [key: string]: unknown };
  
  // Si ya existe, interceptar
  if (Array.isArray(win[arrayName])) {
    interceptArray(win[arrayName] as unknown[], arrayName, onEvent);
    return;
  }
  
  // Si no existe, esperar a que se cree
  let value: unknown[] | undefined;
  Object.defineProperty(win, arrayName, {
    configurable: true,
    enumerable: true,
    get: () => value,
    set: (newValue) => {
      value = newValue;
      if (Array.isArray(newValue)) {
        interceptArray(newValue, arrayName, onEvent);
      }
    },
  });
}

function interceptArray(
  arr: unknown[],
  sourceName: string,
  onEvent: (event: CapturedEvent) => void
): void {
  // Idempotencia: no interceptar dos veces
  if (state.interceptedArrays.has(arr)) return;
  state.interceptedArrays.add(arr);
  
  // Procesar eventos existentes
  processExistingEvents(arr, sourceName, onEvent);
  
  // Interceptar push
  const originalPush = arr.push.bind(arr);
  arr.push = (...items: unknown[]) => {
    items.forEach((item) => {
      if (isValidPushItem(item)) {
        onEvent(createCapturedEvent(item, sourceName));
      }
    });
    return originalPush(...items);
  };
}
```

#### `container-detector.ts` — Detección de GTM

```typescript
/**
 * Detecta containers GTM inspeccionando window.google_tag_manager
 * 
 * Estructura esperada:
 * window.google_tag_manager = {
 *   "GTM-XXXXX": { dataLayer: { name: "dataLayer" } },
 *   "GTM-YYYYY": { dataLayer: { name: "dataLayer2" } },
 * }
 */

export function detectContainers(): string[] {
  const gtm = (window as any).google_tag_manager;
  if (!gtm || typeof gtm !== 'object') return [];
  
  return Object.keys(gtm).filter((key) => {
    // Filtrar solo IDs de container (GTM-XXXXX o G-XXXXX)
    return /^(GTM|G)-[A-Z0-9]+$/.test(key);
  });
}

// Re-detectar cuando llega gtm.js (señal de que GTM cargó)
export function shouldRedetect(eventName: string | null): boolean {
  return eventName === 'gtm.js';
}
```

#### `message-emitter.ts` — Comunicación con Content Script

```typescript
import { MESSAGE_SOURCE } from '../shared/constants';
import type { PageToContentMessage } from '../shared/types/messages';

export function emitEvent(payload: PageToContentMessage['payload']): void {
  try {
    window.postMessage({
      source: MESSAGE_SOURCE,
      type: 'DL_EVENT_CAPTURED',
      payload,
    }, '*');
  } catch {
    // Silent fail - no debe afectar la página
  }
}

export function emitContainers(containers: string[]): void {
  try {
    window.postMessage({
      source: MESSAGE_SOURCE,
      type: 'DL_CONTAINERS_DETECTED',
      payload: { containers },
    }, '*');
  } catch {
    // Silent fail
  }
}
```

### 3.3 Flujo de Inicialización

```
┌─────────────────────────────────────────────────────────────┐
│                    Page Script Init                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ Leer config de      │
                   │ data-attribute      │
                   │ (dataLayerNames)    │
                   └──────────┬──────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │ dataLayer    │ │ dataLayer2   │ │ customDL     │
      │ exists?      │ │ exists?      │ │ exists?      │
      └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
             │                │                │
      ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
      │ YES: Intercept│ │ NO: Define  │  │ ...         │
      │ + process    │  │ setter      │  │             │
      │ existing     │  └─────────────┘  └─────────────┘
      └──────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ Detect GTM          │
                   │ containers          │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ Emit DL_INITIALIZED │
                   └─────────────────────┘
```

### 3.4 Consideraciones de Seguridad

| Riesgo | Mitigación |
|--------|------------|
| Página maliciosa envía mensajes falsos | Content script verifica `MESSAGE_SOURCE` |
| Datos del dataLayer contienen código | Nunca ejecutar, solo serializar |
| Referencias circulares en datos | `JSON.stringify` con replacer que detecta ciclos |
| Error en extensión rompe la página | Todo wrapeado en try/catch, silent fail |

---

## 4. Content Script — Diseño Detallado

### 4.1 Responsabilidades

1. **Inyectar** page script al inicio del documento
2. **Filtrar** mensajes (solo los nuestros)
3. **Retransmitir** al service worker

### 4.2 Módulos

#### `injector.ts` — Inyección del Page Script

```typescript
/**
 * Estrategia de inyección:
 * - Crear <script src="..."> apuntando al page script bundleado
 * - Insertar en documentElement (antes de head/body)
 * - Pasar config via data-attribute
 * - Remover tag después de ejecución (cleanup cosmético)
 */

export function injectPageScript(config: { dataLayerNames: string[] }): void {
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('page-script.js');
  script.dataset.config = JSON.stringify(config);
  
  // Insertar lo antes posible
  const target = document.documentElement;
  target.insertBefore(script, target.firstChild);
  
  // Cleanup después de ejecución
  script.onload = () => script.remove();
  script.onerror = () => script.remove();
}
```

#### `relay.ts` — Retransmisión de Mensajes

```typescript
import { MESSAGE_SOURCE } from '../shared/constants';
import { isValidPageToContentMessage } from '../shared/validators/message-validators';

export function setupRelay(): void {
  window.addEventListener('message', handleMessage);
}

function handleMessage(event: MessageEvent): void {
  // Solo mensajes de nuestra propia ventana
  if (event.source !== window) return;
  
  // Validar estructura
  if (!isValidPageToContentMessage(event.data)) return;
  
  // Retransmitir (fire and forget)
  chrome.runtime.sendMessage(mapToBackgroundMessage(event.data))
    .catch(() => {
      // SW might be asleep, message lost - acceptable
    });
}

function mapToBackgroundMessage(msg: PageToContentMessage): ContentToBackgroundMessage {
  switch (msg.type) {
    case 'DL_EVENT_CAPTURED':
      return { type: 'DL_EVENT', payload: msg.payload };
    case 'DL_CONTAINERS_DETECTED':
      return { type: 'DL_CONTAINERS', payload: msg.payload };
    case 'DL_INITIALIZED':
      return { type: 'DL_INIT', payload: msg.payload };
  }
}
```

### 4.3 Principio de Stateless

```
┌─────────────────────────────────────────────────────────────┐
│                     Content Script                           │
│                                                              │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐    │
│  │ Message  │  ────▶  │ Validate │  ────▶  │ Forward  │    │
│  │ Received │         │ & Filter │         │ to SW    │    │
│  └──────────┘         └──────────┘         └──────────┘    │
│                                                              │
│  • NO almacena eventos                                       │
│  • NO mantiene conexiones                                    │
│  • NO procesa datos                                          │
│  • Solo valida origen y retransmite                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Service Worker — Diseño Detallado

### 5.1 Responsabilidades

1. **Almacenar** estado por tab (eventos, containers, settings)
2. **Coordinar** mensajes entre contextos
3. **Persistir** estado crítico para sobrevivir suspensión
4. **Broadcast** actualizaciones a clientes conectados

### 5.2 Módulos

#### `tab-manager.ts` — Gestión de Estado por Tab

```typescript
/**
 * TabManager es el core del estado.
 * Implementa el patrón Repository para TabState.
 */

import type { TabState, DataLayerEvent } from '../shared/types';

export class TabManager {
  private tabs = new Map<number, TabState>();
  private maxEventsPerTab = 500;
  
  // --- Queries ---
  
  getState(tabId: number): TabState | undefined {
    return this.tabs.get(tabId);
  }
  
  getEvents(tabId: number): DataLayerEvent[] {
    return this.tabs.get(tabId)?.events ?? [];
  }
  
  getContainers(tabId: number): string[] {
    return this.tabs.get(tabId)?.containers ?? [];
  }
  
  // --- Commands ---
  
  addEvent(tabId: number, event: Omit<DataLayerEvent, 'index'>): DataLayerEvent | null {
    const state = this.getOrCreateState(tabId);
    
    if (!state.isRecording) return null;
    
    const fullEvent: DataLayerEvent = {
      ...event,
      index: state.nextIndex++,
    };
    
    state.events.push(fullEvent);
    
    // Enforce FIFO limit
    if (state.events.length > this.maxEventsPerTab) {
      state.events.shift();
    }
    
    return fullEvent;
  }
  
  updateContainers(tabId: number, containers: string[]): void {
    const state = this.getOrCreateState(tabId);
    // Merge, no replace (containers pueden detectarse en momentos distintos)
    state.containers = [...new Set([...state.containers, ...containers])];
  }
  
  clearEvents(tabId: number): void {
    const state = this.tabs.get(tabId);
    if (state) {
      state.events = [];
      state.nextIndex = 1;
    }
  }
  
  setRecording(tabId: number, isRecording: boolean): void {
    const state = this.getOrCreateState(tabId);
    state.isRecording = isRecording;
  }
  
  onNavigate(tabId: number, newUrl: string): void {
    const state = this.tabs.get(tabId);
    if (state) {
      state.events = [];
      state.nextIndex = 1;
      state.url = newUrl;
      // containers se mantienen - se re-detectarán
    }
  }
  
  removeTab(tabId: number): void {
    this.tabs.delete(tabId);
  }
  
  // --- Helpers ---
  
  private getOrCreateState(tabId: number): TabState {
    let state = this.tabs.get(tabId);
    if (!state) {
      state = {
        tabId,
        events: [],
        containers: [],
        url: '',
        isRecording: true,
        nextIndex: 1,
      };
      this.tabs.set(tabId, state);
    }
    return state;
  }
  
  // --- Serialization (for persistence) ---
  
  serialize(): Record<number, TabState> {
    return Object.fromEntries(this.tabs);
  }
  
  hydrate(data: Record<number, TabState>): void {
    this.tabs = new Map(Object.entries(data).map(([k, v]) => [Number(k), v]));
  }
}
```

#### `port-manager.ts` — Gestión de Conexiones

```typescript
/**
 * PortManager maneja las conexiones long-lived con DevTools y Popup.
 * Permite broadcast eficiente a todos los listeners de un tab.
 */

import { DEVTOOLS_PORT_NAME, POPUP_PORT_NAME } from '../shared/constants';
import type { BackgroundToClientMessage } from '../shared/types/messages';

interface ConnectedPort {
  port: chrome.runtime.Port;
  tabId: number;
  type: 'devtools' | 'popup';
}

export class PortManager {
  private ports = new Map<number, Set<ConnectedPort>>();
  
  handleConnection(port: chrome.runtime.Port): void {
    if (port.name !== DEVTOOLS_PORT_NAME && port.name !== POPUP_PORT_NAME) {
      return;
    }
    
    const type = port.name === DEVTOOLS_PORT_NAME ? 'devtools' : 'popup';
    
    // DevTools no tiene sender.tab, debe enviar INIT con tabId
    // Popup puede obtenerlo de chrome.tabs.query
    port.onMessage.addListener((msg) => {
      if (msg.type === 'INIT' && typeof msg.tabId === 'number') {
        this.registerPort(port, msg.tabId, type);
      }
    });
    
    port.onDisconnect.addListener(() => {
      this.unregisterPort(port);
    });
  }
  
  broadcast(tabId: number, message: BackgroundToClientMessage): void {
    const tabPorts = this.ports.get(tabId);
    if (!tabPorts) return;
    
    for (const { port } of tabPorts) {
      try {
        port.postMessage(message);
      } catch {
        // Port might be disconnected
      }
    }
  }
  
  broadcastToAll(message: BackgroundToClientMessage): void {
    for (const [tabId] of this.ports) {
      this.broadcast(tabId, message);
    }
  }
  
  hasListeners(tabId: number): boolean {
    return (this.ports.get(tabId)?.size ?? 0) > 0;
  }
  
  private registerPort(port: chrome.runtime.Port, tabId: number, type: 'devtools' | 'popup'): void {
    if (!this.ports.has(tabId)) {
      this.ports.set(tabId, new Set());
    }
    this.ports.get(tabId)!.add({ port, tabId, type });
  }
  
  private unregisterPort(port: chrome.runtime.Port): void {
    for (const [tabId, portSet] of this.ports) {
      for (const connectedPort of portSet) {
        if (connectedPort.port === port) {
          portSet.delete(connectedPort);
          if (portSet.size === 0) {
            this.ports.delete(tabId);
          }
          return;
        }
      }
    }
  }
}
```

#### `message-handler.ts` — Router de Mensajes

```typescript
/**
 * Centraliza el handling de todos los mensajes entrantes.
 * Patrón: Command Handler con dispatch por type.
 */

import type { TabManager } from './tab-manager';
import type { PortManager } from './port-manager';
import type { 
  ContentToBackgroundMessage,
  ClientToBackgroundRequest,
  ClientToBackgroundResponse 
} from '../shared/types/messages';

export class MessageHandler {
  constructor(
    private tabManager: TabManager,
    private portManager: PortManager,
  ) {}
  
  // Mensajes de Content Scripts (no necesitan response)
  handleContentMessage(
    message: ContentToBackgroundMessage,
    sender: chrome.runtime.MessageSender
  ): void {
    const tabId = sender.tab?.id;
    if (!tabId) return;
    
    switch (message.type) {
      case 'DL_EVENT':
        this.handleNewEvent(tabId, message.payload);
        break;
      case 'DL_CONTAINERS':
        this.handleContainers(tabId, message.payload.containers);
        break;
      case 'DL_INIT':
        // Podría usarse para logging/debug
        break;
    }
  }
  
  // Requests de Panel/Popup (necesitan response)
  handleClientRequest(
    request: ClientToBackgroundRequest,
    sender: chrome.runtime.MessageSender
  ): ClientToBackgroundResponse {
    switch (request.type) {
      case 'GET_EVENTS':
        return {
          type: 'EVENTS',
          payload: { events: this.tabManager.getEvents(request.payload.tabId) },
        };
        
      case 'GET_CONTAINERS':
        return {
          type: 'CONTAINERS',
          payload: { containers: this.tabManager.getContainers(request.payload.tabId) },
        };
        
      case 'GET_TAB_STATE':
        return {
          type: 'TAB_STATE',
          payload: this.tabManager.getState(request.payload.tabId) ?? null,
        };
        
      case 'CLEAR_EVENTS':
        this.tabManager.clearEvents(request.payload.tabId);
        this.portManager.broadcast(request.payload.tabId, {
          type: 'TAB_STATE_RESET',
          payload: { tabId: request.payload.tabId, reason: 'cleared' },
        });
        return { type: 'OK' };
        
      case 'SET_RECORDING':
        this.tabManager.setRecording(
          request.payload.tabId,
          request.payload.isRecording
        );
        this.portManager.broadcast(request.payload.tabId, {
          type: 'RECORDING_CHANGED',
          payload: { isRecording: request.payload.isRecording },
        });
        return { type: 'OK' };
        
      default:
        return { type: 'ERROR', payload: { message: 'Unknown request type' } };
    }
  }
  
  private handleNewEvent(tabId: number, payload: any): void {
    const event = this.tabManager.addEvent(tabId, payload);
    if (event) {
      this.portManager.broadcast(tabId, {
        type: 'NEW_EVENT',
        payload: event,
      });
    }
  }
  
  private handleContainers(tabId: number, containers: any[]): void {
    this.tabManager.updateContainers(
      tabId,
      containers.map((c) => c.id)
    );
    this.portManager.broadcast(tabId, {
      type: 'CONTAINERS_UPDATED',
      payload: { containers: this.tabManager.getContainers(tabId) },
    });
  }
}
```

### 5.3 Ciclo de Vida del Service Worker

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Service Worker Lifecycle                          │
└─────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐
    │   INSTALL   │ ──── Una vez al instalar/actualizar extensión
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │   ACTIVE    │ ──── Escuchando eventos, procesando mensajes
    └──────┬──────┘
           │
           │ (30s sin actividad)
           ▼
    ┌─────────────┐
    │  SUSPENDED  │ ──── Estado en memoria perdido
    └──────┬──────┘
           │
           │ (mensaje entrante / alarm / evento)
           ▼
    ┌─────────────┐
    │   WAKE UP   │ ──── Reconstruir estado desde storage.session
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │   ACTIVE    │ ──── Continúa operando
    └─────────────┘


Estrategia de Persistencia:
┌─────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  TabManager (memoria)  ◀──────▶  chrome.storage.session (backup)    │
│                                                                      │
│  • Write: Debounced 500ms después de cada cambio                    │
│  • Read: Al despertar (SW init), hidratar desde storage             │
│  • Events se almacenan truncados si exceden límite                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.4 Inicialización del Service Worker

```typescript
// src/background/index.ts

import { TabManager } from './tab-manager';
import { PortManager } from './port-manager';
import { MessageHandler } from './message-handler';
import { StorageManager } from './storage';

// Inicializar managers
const tabManager = new TabManager();
const portManager = new PortManager();
const messageHandler = new MessageHandler(tabManager, portManager);
const storageManager = new StorageManager(tabManager);

// Hidratar estado desde storage (wake-up)
storageManager.hydrate();

// Listener de conexiones (DevTools, Popup)
chrome.runtime.onConnect.addListener((port) => {
  portManager.handleConnection(port);
});

// Listener de mensajes
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Mensajes de content scripts
  if (sender.tab?.id) {
    messageHandler.handleContentMessage(message, sender);
    return false; // No async response
  }
  
  // Requests de panel/popup
  const response = messageHandler.handleClientRequest(message, sender);
  sendResponse(response);
  return false;
});

// Lifecycle de tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  tabManager.removeTab(tabId);
  storageManager.persist();
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) { // main frame only
    tabManager.onNavigate(details.tabId, details.url);
    portManager.broadcast(details.tabId, {
      type: 'TAB_STATE_RESET',
      payload: { tabId: details.tabId, reason: 'navigation' },
    });
    storageManager.persist();
  }
});
```

---

## 6. DevTools Panel — Diseño Detallado

### 6.0 Layout del Panel

#### Vista General

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ DataLayer                                                              DevTools │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ TOOLBAR                                                                     │ │
│  │ ┌────┐ ┌─────┐                      ┌─────────────────┐ ┌──────┐ ┌──────┐  │ │
│  │ │ 🔴 │ │ 🗑️  │  📊 42 events        │ GTM-XXXXX       │ │ GTM-Y│ │  ⚙️  │  │ │
│  │ │Rec │ │Clear│                      │                 │ │      │ │ Set  │  │ │
│  │ └────┘ └─────┘                      └─────────────────┘ └──────┘ └──────┘  │ │
│  │                                                                             │ │
│  │ ┌─────────────────────────────────────────────────────┐ ┌────────────────┐ │ │
│  │ │ 🔍 Search events...                                 │ │ Filter ▾       │ │ │
│  │ └─────────────────────────────────────────────────────┘ └────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌──────────────────────────┬───────────────────────────────────────────────┐   │
│  │ EVENT LIST (30%)         │ DETAIL VIEW (70%)                              │   │
│  │                          │                                                │   │
│  │ ┌──────────────────────┐ │ ┌────────────────────────────────────────────┐ │   │
│  │ │ 10:30:01.123         │ │ │ Breadcrumb: root › ecommerce › items[0]    │ │   │
│  │ │   gtm.js        🏷️   │ │ └────────────────────────────────────────────┘ │   │
│  │ └──────────────────────┘ │                                                │   │
│  │ ┌──────────────────────┐ │ ┌─────────────────┐ ┌──────────────┐           │   │
│  │ │ 10:30:01.456         │ │ │ 🌳 Tree         │ │ 📄 Raw       │ [📋 Copy] │   │
│  │ │   page_view     🏷️   │ │ └─────────────────┘ └──────────────┘           │   │
│  │ └──────────────────────┘ │                                                │   │
│  │ ┌──────────────────────┐ │ ┌────────────────────────────────────────────┐ │   │
│  │ │ 10:30:02.789         │ │ │                                            │ │   │
│  │ │ ▶ add_to_cart   🛒   │◀│ │  ▾ event: "add_to_cart"                    │ │   │
│  │ └──────────────────────┘ │ │  ▾ ecommerce: {3 keys}                     │ │   │
│  │ ┌──────────────────────┐ │ │    ▾ currency: "USD"                       │ │   │
│  │ │ 10:30:05.012         │ │ │    ▾ value: 29.99                          │ │   │
│  │ │   purchase      🛒   │ │ │    ▾ items: Array(1)                       │ │   │
│  │ └──────────────────────┘ │ │      ▾ 0: {4 keys}                         │ │   │
│  │ ┌──────────────────────┐ │ │        ▸ item_id: "SKU-123"                │ │   │
│  │ │ 10:30:06.345         │ │ │        ▸ item_name: "Widget"               │ │   │
│  │ │   (push)        ⬜   │ │ │        ▸ price: 29.99                      │ │   │
│  │ └──────────────────────┘ │ │        ▸ quantity: 1                       │ │   │
│  │                          │ │                                            │ │   │
│  │         ↓ auto-scroll    │ │                                            │ │   │
│  │                          │ └────────────────────────────────────────────┘ │   │
│  └──────────────────────────┴───────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ STATUS BAR                                                                  │ │
│  │ 🟢 Connected │ Recording │ 42 events │ 2 containers                        │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Dimensiones y Constraints

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                  │
│  Min Width: 500px (panel completo)                                              │
│  ──────────────────────────────────────────────────────────────────────────     │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ TOOLBAR: height: 72px (2 rows)                                          │    │
│  │   Row 1: 36px - Buttons + badges                                        │    │
│  │   Row 2: 36px - Search + filter                                         │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
│  ┌────────────────────────┐ ┌──────────────────────────────────────────────┐    │
│  │ EVENT LIST             │ │ DETAIL VIEW                                   │    │
│  │                        │ │                                               │    │
│  │ Width: 30%             │ │ Width: 70%                                    │    │
│  │ Min: 200px             │◀│ Min: 300px                                    │    │
│  │ Max: 400px             │▶│ Flex: 1                                       │    │
│  │                        │ │                                               │    │
│  │ Item Height: 48px      │ │ Header: 40px (breadcrumb + view toggle)       │    │
│  │ (fixed for virtual)    │ │ Body: flex-1 (scroll)                         │    │
│  │                        │ │                                               │    │
│  │ Virtualized:           │ │ JSON Tree:                                    │    │
│  │ - Overscan: 5 items    │ │ - Node height: 24px                           │    │
│  │ - Render: visible only │ │ - Indent: 16px per level                      │    │
│  │                        │ │ - Max depth rendered: 20                      │    │
│  └────────────────────────┘ └──────────────────────────────────────────────┘    │
│              ▲                                                                   │
│              │ Drag handle (resizable)                                          │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ STATUS BAR: height: 24px                                                │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Event List Item — Estructura

```
┌────────────────────────────────────────────────────────────────┐
│ EVENT ITEM (48px height)                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ┌────┐                                                   │   │
│  │ │    │  10:30:02.789                         [source] 🏷️ │   │ ← Row 1: timestamp + badges
│  │ │type│                                                   │   │
│  │ │bar │  add_to_cart                              ✅ / ⚠️ │   │ ← Row 2: event name + validation
│  │ │    │                                                   │   │
│  │ └────┘                                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Type Bar Colors (4px left border):                             │
│  ├── 🔵 Blue:    Standard events (event key present)           │
│  ├── 🟢 Green:   Ecommerce (has ecommerce object)              │
│  ├── 🔴 Red:     Errors (event contains "error"/"exception")   │
│  ├── ⬜ Gray:    Push without event key                         │
│  └── 🌫️ Dimmed:  GTM internal (gtm.js, gtm.dom, gtm.load)      │
│                                                                 │
│  States:                                                        │
│  ├── Default:   bg-surface-primary                             │
│  ├── Hover:     bg-surface-hover                               │
│  ├── Selected:  bg-surface-selected + ring-2 ring-accent       │
│  └── New:       brief highlight animation (pulse)               │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### JSON Tree View — Estructura de Nodos

```
┌────────────────────────────────────────────────────────────────┐
│ TREE NODE (24px height per node)                                │
│                                                                 │
│  Collapsed Object:                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ▸ ecommerce: {3 keys}                                    │   │
│  │ ↑ ↑          ↑                                           │   │
│  │ │ │          └── Preview badge (gray, italic)            │   │
│  │ │ └── Key name (--color-key: blue)                       │   │
│  │ └── Toggle arrow (rotate 90° when expanded)              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Expanded Object:                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ▾ ecommerce:                                             │   │
│  │     ▸ currency: "USD"                                    │   │
│  │     ▸ value: 29.99                                       │   │
│  │     ▸ items: Array(1)                                    │   │
│  │       └─────────────┬─────────────────────────────────   │   │
│  │                     └── 16px indent per level            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Primitive Values (leaf nodes):                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │     item_id: "SKU-123"     ← string (--color-string)     │   │
│  │     price: 29.99           ← number (--color-number)     │   │
│  │     available: true        ← boolean (--color-boolean)   │   │
│  │     discount: null         ← null (--color-null)         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Long String Truncation:                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │     description: "This is a very long product desc..."  │   │
│  │                   └── Truncate at 100 chars + tooltip    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Array Node:                                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ▾ items: Array(3)                                        │   │
│  │     ▸ 0: {4 keys}                                        │   │
│  │     ▸ 1: {4 keys}                                        │   │
│  │     ▸ 2: {4 keys}                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Large Array (>100 items):                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ▾ items: Array(500)                                      │   │
│  │     ▸ 0: {...}                                           │   │
│  │     ▸ 1: {...}                                           │   │
│  │     ... (showing 100 of 500)                             │   │
│  │     ▸ 99: {...}                                          │   │
│  │     [Show more...]  ← Button to load next 100            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### Toolbar Components

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ TOOLBAR - ROW 1 (Actions + Status)                                               │
│                                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  ┌──────────────────────────────┐│
│  │ 🔴 Record│  │ 🗑️ Clear │  │ 📊 42 events │  │  Containers                  ││
│  │          │  │          │  │               │  │  ┌─────────┐ ┌─────────┐     ││
│  │  Toggle  │  │  Button  │  │  Counter      │  │  │GTM-XXXXX│ │GTM-YYYYY│     ││
│  │  Button  │  │          │  │  (live)       │  │  └─────────┘ └─────────┘     ││
│  └──────────┘  └──────────┘  └───────────────┘  └──────────────────────────────┘│
│                                                                                  │
│  Record Button States:                                                           │
│  ├── Recording:  🔴 Red dot, pulsing animation, "Recording"                     │
│  └── Paused:     ⏸️ Gray, "Paused"                                              │
│                                                                                  │
│  Container Badges:                                                               │
│  ├── Click: Filter events by container                                          │
│  ├── Color: Distinct color per container (generated from hash)                  │
│  └── Tooltip: Full container ID                                                 │
│                                                                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│ TOOLBAR - ROW 2 (Search + Filter)                                               │
│                                                                                  │
│  ┌─────────────────────────────────────────────────────┐  ┌──────────────────┐  │
│  │ 🔍 Search events...                           [X]   │  │ ▾ Filter         │  │
│  │                                                     │  │                  │  │
│  │  - Placeholder when empty                           │  │  Dropdown:       │  │
│  │  - Live search (debounced 300ms)                    │  │  ├─ All Events   │  │
│  │  - Clear button when has text                       │  │  ├─ ─────────    │  │
│  │  - Cmd/Ctrl+F to focus                              │  │  ├─ page_view    │  │
│  │                                                     │  │  ├─ add_to_cart  │  │
│  └─────────────────────────────────────────────────────┘  │  ├─ purchase     │  │
│                                                           │  └─ ...          │  │
│                                                           └──────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Detail View Header

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ DETAIL VIEW HEADER (40px)                                                       │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                           │  │
│  │  Breadcrumb                                    View Mode Toggle     Copy  │  │
│  │  ┌─────────────────────────────────────┐      ┌───────────────────┐ ┌───┐│  │
│  │  │ root › ecommerce › items › 0        │      │ 🌳 Tree │ 📄 Raw  │ │📋││  │
│  │  │                                     │      └───────────────────┘ └───┘│  │
│  │  │ Clickable path segments             │               ▲                  │  │
│  │  │ Click "root" to go back to top      │               │                  │  │
│  │  │ Click "ecommerce" to focus that     │      SegmentedControl            │  │
│  │  │                                     │      (mutually exclusive)        │  │
│  │  └─────────────────────────────────────┘                                  │  │
│  │                                                                           │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  When no event selected:                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                           │  │
│  │                     Select an event to view details                       │  │
│  │                                                                           │  │
│  │                     [Illustration/Empty state icon]                       │  │
│  │                                                                           │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

#### View Mode Toggle — Comportamiento

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ VIEW MODE TOGGLE (SegmentedControl)                                             │
│                                                                                 │
│  Componente tipo "radio buttons" visualizados como tabs unidos.                │
│  Solo UNA vista activa a la vez. Click cambia la vista.                        │
│                                                                                 │
│  Estado: Tree View activo                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌──────────────────┐┌──────────────────┐                               │   │
│  │  │ 🌳 Tree          ││ 📄 Raw           │                               │   │
│  │  │ ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ ││                  │  ← underline = active        │   │
│  │  │ bg-selected      ││ bg-default       │                               │   │
│  │  └──────────────────┘└──────────────────┘                               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│                              │ Click "Raw"                                      │
│                              ▼                                                  │
│                                                                                 │
│  Estado: Raw View activo                                                        │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  ┌──────────────────┐┌──────────────────┐                               │   │
│  │  │ 🌳 Tree          ││ 📄 Raw           │                               │   │
│  │  │                  ││ ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀ │  ← underline = active        │   │
│  │  │ bg-default       ││ bg-selected      │                               │   │
│  │  └──────────────────┘└──────────────────┘                               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  Implementación:                                                                │
│  ├── Zustand state: viewMode: 'tree' | 'raw'                                   │
│  ├── Click handler: setViewMode('tree') / setViewMode('raw')                   │
│  ├── Render: viewMode === 'tree' ? <JsonTreeView /> : <JsonRawView />          │
│  └── Keyboard: Tab entre opciones, Enter/Space para seleccionar                │
│                                                                                 │
│  Accessibility:                                                                 │
│  ├── role="tablist" en el container                                            │
│  ├── role="tab" en cada botón                                                  │
│  ├── aria-selected="true" en el activo                                         │
│  └── role="tabpanel" en el contenido (Tree o Raw)                              │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

#### Raw JSON View

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ RAW JSON VIEW                                                                   │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ 1  │ {                                                                    │  │
│  │ 2  │   "event": "add_to_cart",                    ← Syntax highlighting  │  │
│  │ 3  │   "ecommerce": {                                                     │  │
│  │ 4  │     "currency": "USD",                       ← strings: green       │  │
│  │ 5  │     "value": 29.99,                          ← numbers: orange      │  │
│  │ 6  │     "items": [                                                       │  │
│  │ 7  │       {                                                              │  │
│  │ 8  │         "item_id": "SKU-123",                                        │  │
│  │ 9  │         "item_name": "Widget",                                       │  │
│  │10  │         "price": 29.99,                                              │  │
│  │11  │         "quantity": 1                                                │  │
│  │12  │       }                                                              │  │
│  │13  │     ]                                                                │  │
│  │14  │   }                                                                  │  │
│  │15  │ }                                                                    │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  Features:                                                                      │
│  ├── Line numbers (optional, off by default)                                   │
│  ├── Monospace font (JetBrains Mono / Fira Code / system mono)                 │
│  ├── Horizontal scroll for long lines                                          │
│  ├── Same color scheme as Tree View                                            │
│  └── Select all on focus for easy copy                                         │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

#### Status Bar

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ STATUS BAR (24px, bottom)                                                       │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ 🟢 Connected │ 🔴 Recording │ 42 events │ 2 containers │ Last: 10:30:05  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
│  Indicators:                                                                    │
│  ├── Connection: 🟢 Connected / 🔴 Disconnected / 🟡 Reconnecting              │
│  ├── Recording:  🔴 Recording / ⏸️ Paused                                      │
│  ├── Events:     Total count (updates live)                                    │
│  ├── Containers: Number detected                                               │
│  └── Last Event: Timestamp of most recent event                                │
│                                                                                 │
│  Disconnected state:                                                            │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │ 🔴 Disconnected — Attempting to reconnect...                [Retry Now]  │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

#### Responsive Behavior

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ RESPONSIVE BREAKPOINTS                                                           │
│                                                                                  │
│  Wide (>800px): Default layout                                                   │
│  ┌────────────────────────┬─────────────────────────────────────────────────┐   │
│  │ Event List (30%)       │ Detail View (70%)                               │   │
│  │ 240px                  │ 560px                                           │   │
│  └────────────────────────┴─────────────────────────────────────────────────┘   │
│                                                                                  │
│  Medium (500-800px): Narrower event list                                         │
│  ┌──────────────────┬───────────────────────────────────────────────────────┐   │
│  │ Event List       │ Detail View                                           │   │
│  │ 200px (min)      │ flex-1                                                │   │
│  │ - Hide source    │                                                       │   │
│  │   badges         │                                                       │   │
│  └──────────────────┴───────────────────────────────────────────────────────┘   │
│                                                                                  │
│  Narrow (<500px): Stacked layout (optional, may not be needed for DevTools)     │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │ Event List (collapsible)                                                  │   │
│  ├──────────────────────────────────────────────────────────────────────────┤   │
│  │ Detail View                                                               │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Dark / Light Theme Variants

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ THEME COLORS                                                                     │
│                                                                                  │
│  Light Theme                          Dark Theme                                 │
│  ┌────────────────────────────┐       ┌────────────────────────────┐            │
│  │ Surface Primary: #FFFFFF   │       │ Surface Primary: #1E1E1E   │            │
│  │ Surface Secondary: #F5F5F5 │       │ Surface Secondary: #252526 │            │
│  │ Surface Hover: #E8E8E8     │       │ Surface Hover: #2A2D2E     │            │
│  │ Surface Selected: #E3F2FD  │       │ Surface Selected: #094771  │            │
│  │ Text Primary: #1F1F1F      │       │ Text Primary: #CCCCCC      │            │
│  │ Text Secondary: #666666    │       │ Text Secondary: #8C8C8C    │            │
│  │ Border: #E0E0E0            │       │ Border: #3C3C3C            │            │
│  └────────────────────────────┘       └────────────────────────────┘            │
│                                                                                  │
│  Syntax Highlighting (consistent across themes):                                 │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ Token        │ Light          │ Dark                                       │ │
│  ├──────────────┼────────────────┼────────────────────────────────────────────┤ │
│  │ String       │ #22863A        │ #85E89D                                    │ │
│  │ Number       │ #E36209        │ #FFAB70                                    │ │
│  │ Boolean      │ #6F42C1        │ #B392F0                                    │ │
│  │ Null         │ #6A737D        │ #959DA5                                    │ │
│  │ Key          │ #005CC5        │ #79B8FF                                    │ │
│  │ Bracket      │ #586069        │ #E1E4E8                                    │ │
│  └──────────────┴────────────────┴────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Arquitectura React

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DevTools Panel                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                         App.tsx                                 │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │                  useConnection()                          │  │ │
│  │  │  • Abre port al SW                                        │  │ │
│  │  │  • Escucha NEW_EVENT, TAB_STATE_RESET                    │  │ │
│  │  │  • Actualiza store                                        │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               │                                      │
│                               ▼                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                      Zustand Store                              │ │
│  │                                                                  │ │
│  │  events[] ─────────────▶ EventList ──────▶ EventItem            │ │
│  │  selectedId ───────────▶ DetailView ─────▶ JsonTreeView         │ │
│  │  searchQuery ──────────▶ (selector) ─────▶ filteredEvents       │ │
│  │  settings ─────────────▶ SettingsDialog                         │ │
│  │                                                                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Store Design (Zustand)

```typescript
// src/devtools/panel/store/index.ts

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { DataLayerEvent, UserSettings } from '../../../shared/types';

interface EventFilters {
  eventNames: string[];
  containers: string[];
  timeRange: { from: number; to: number } | null;
}

interface PanelState {
  // --- Core State ---
  events: DataLayerEvent[];
  selectedEventId: string | null;
  containers: string[];
  isRecording: boolean;
  isConnected: boolean;
  
  // --- UI State ---
  searchQuery: string;
  filters: EventFilters;
  viewMode: 'tree' | 'raw';
  expandedPaths: Set<string>;
  
  // --- Settings ---
  settings: UserSettings;
}

interface PanelActions {
  // --- Event Actions ---
  addEvent: (event: DataLayerEvent) => void;
  setEvents: (events: DataLayerEvent[]) => void;
  clearEvents: () => void;
  
  // --- Selection ---
  selectEvent: (id: string | null) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  
  // --- Recording ---
  setRecording: (isRecording: boolean) => void;
  
  // --- Search & Filter ---
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<EventFilters>) => void;
  clearFilters: () => void;
  
  // --- UI ---
  setViewMode: (mode: 'tree' | 'raw') => void;
  togglePath: (path: string) => void;
  
  // --- Connection ---
  setConnected: (isConnected: boolean) => void;
  setContainers: (containers: string[]) => void;
  
  // --- Settings ---
  updateSettings: (settings: Partial<UserSettings>) => void;
}

type PanelStore = PanelState & PanelActions;

export const usePanelStore = create<PanelStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    events: [],
    selectedEventId: null,
    containers: [],
    isRecording: true,
    isConnected: false,
    searchQuery: '',
    filters: { eventNames: [], containers: [], timeRange: null },
    viewMode: 'tree',
    expandedPaths: new Set(),
    settings: DEFAULT_SETTINGS,
    
    // Actions
    addEvent: (event) => set((state) => ({
      events: [...state.events, event].slice(-state.settings.maxEventsPerTab),
    })),
    
    setEvents: (events) => set({ events }),
    
    clearEvents: () => set({ events: [], selectedEventId: null }),
    
    selectEvent: (id) => set({ selectedEventId: id }),
    
    selectNext: () => {
      const { events, selectedEventId } = get();
      const currentIndex = events.findIndex((e) => e.id === selectedEventId);
      const nextIndex = Math.min(currentIndex + 1, events.length - 1);
      set({ selectedEventId: events[nextIndex]?.id ?? null });
    },
    
    selectPrevious: () => {
      const { events, selectedEventId } = get();
      const currentIndex = events.findIndex((e) => e.id === selectedEventId);
      const prevIndex = Math.max(currentIndex - 1, 0);
      set({ selectedEventId: events[prevIndex]?.id ?? null });
    },
    
    setRecording: (isRecording) => set({ isRecording }),
    
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    
    setFilters: (filters) => set((state) => ({
      filters: { ...state.filters, ...filters },
    })),
    
    clearFilters: () => set({
      filters: { eventNames: [], containers: [], timeRange: null },
      searchQuery: '',
    }),
    
    setViewMode: (viewMode) => set({ viewMode }),
    
    togglePath: (path) => set((state) => {
      const newPaths = new Set(state.expandedPaths);
      if (newPaths.has(path)) {
        newPaths.delete(path);
      } else {
        newPaths.add(path);
      }
      return { expandedPaths: newPaths };
    }),
    
    setConnected: (isConnected) => set({ isConnected }),
    
    setContainers: (containers) => set({ containers }),
    
    updateSettings: (settings) => set((state) => ({
      settings: { ...state.settings, ...settings },
    })),
  }))
);
```

### 6.3 Selectors (Derived State)

```typescript
// src/devtools/panel/store/selectors.ts

import { usePanelStore } from './index';
import { searchEvents } from '../lib/search';

// Eventos filtrados (búsqueda + filtros)
export const useFilteredEvents = () => {
  return usePanelStore((state) => {
    let events = state.events;
    
    // Apply search
    if (state.searchQuery) {
      events = searchEvents(events, state.searchQuery);
    }
    
    // Apply event name filter
    if (state.filters.eventNames.length > 0) {
      events = events.filter((e) =>
        e.eventName && state.filters.eventNames.includes(e.eventName)
      );
    }
    
    // Apply container filter
    if (state.filters.containers.length > 0) {
      events = events.filter((e) =>
        e.containerIds.some((c) => state.filters.containers.includes(c))
      );
    }
    
    // Apply time range filter
    if (state.filters.timeRange) {
      const { from, to } = state.filters.timeRange;
      events = events.filter((e) => e.timestamp >= from && e.timestamp <= to);
    }
    
    return events;
  });
};

// Evento seleccionado
export const useSelectedEvent = () => {
  return usePanelStore((state) =>
    state.events.find((e) => e.id === state.selectedEventId) ?? null
  );
};

// Event names únicos (para filtro dropdown)
export const useUniqueEventNames = () => {
  return usePanelStore((state) => {
    const names = new Set<string>();
    state.events.forEach((e) => {
      if (e.eventName) names.add(e.eventName);
    });
    return Array.from(names).sort();
  });
};

// Stats
export const useEventStats = () => {
  return usePanelStore((state) => ({
    total: state.events.length,
    withEvent: state.events.filter((e) => e.eventName).length,
    ecommerce: state.events.filter((e) => 'ecommerce' in e.data).length,
  }));
};
```

### 6.4 Connection Hook

```typescript
// src/devtools/panel/hooks/use-connection.ts

import { useEffect, useRef } from 'react';
import { usePanelStore } from '../store';
import { DEVTOOLS_PORT_NAME } from '../../../shared/constants';

export function useConnection() {
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const { setConnected, addEvent, setEvents, setContainers, clearEvents, setRecording } = usePanelStore();
  
  useEffect(() => {
    const tabId = chrome.devtools.inspectedWindow.tabId;
    
    // Conectar al SW
    const port = chrome.runtime.connect({ name: DEVTOOLS_PORT_NAME });
    portRef.current = port;
    
    // Enviar init con tabId
    port.postMessage({ type: 'INIT', tabId });
    
    // Solicitar estado inicial
    chrome.runtime.sendMessage(
      { type: 'GET_TAB_STATE', payload: { tabId } },
      (response) => {
        if (response?.type === 'TAB_STATE' && response.payload) {
          setEvents(response.payload.events);
          setContainers(response.payload.containers);
          setRecording(response.payload.isRecording);
        }
        setConnected(true);
      }
    );
    
    // Escuchar mensajes del SW
    port.onMessage.addListener((msg) => {
      switch (msg.type) {
        case 'NEW_EVENT':
          addEvent(msg.payload);
          break;
        case 'CONTAINERS_UPDATED':
          setContainers(msg.payload.containers);
          break;
        case 'TAB_STATE_RESET':
          clearEvents();
          break;
        case 'RECORDING_CHANGED':
          setRecording(msg.payload.isRecording);
          break;
      }
    });
    
    port.onDisconnect.addListener(() => {
      setConnected(false);
      // Intentar reconectar después de 1s
      setTimeout(() => {
        // Reconnection logic
      }, 1000);
    });
    
    return () => {
      port.disconnect();
    };
  }, []);
  
  return portRef;
}
```

### 6.5 Component Tree

```
App
├── Toolbar
│   ├── RecordButton
│   ├── ClearButton
│   ├── EventCounter
│   ├── ContainerBadges
│   └── SettingsButton
├── SearchBar
│   ├── SearchInput
│   └── FilterDropdown
├── SplitPane (resizable)
│   ├── EventList (left, 30%)
│   │   └── VirtualList
│   │       └── EventItem (×N)
│   │           ├── Timestamp
│   │           ├── EventName
│   │           ├── SourceBadge
│   │           └── ValidationIcon (F2)
│   └── DetailView (right, 70%)
│       ├── Breadcrumb
│       ├── ViewModeToggle
│       ├── CopyButton
│       └── (conditional)
│           ├── JsonTreeView
│           │   └── TreeNode (recursive)
│           └── JsonRawView
└── StatusBar
    └── ConnectionStatus
```

---

## 7. Popup — Diseño Detallado

### 7.1 Layout

```
┌─────────────────────────────────┐
│ Strata                       ⚙  │  ← Header (32px)
├─────────────────────────────────┤
│                                 │
│  📊 42 events captured          │  ← Event Summary
│                                 │
│  Containers:                    │  ← Container List
│  [GTM-XXXXX] [GTM-YYYYY]       │
│                                 │
│  Last event:                    │  ← Last Event Preview
│  ┌─ purchase (10:30:05)         │
│  │  transaction_id: "T-123"     │
│  │  value: 59.98                │
│  └──────────────────────────    │
│                                 │
│  [🔧 Open DevTools Panel]       │  ← Quick Actions
│                                 │
└─────────────────────────────────┘
        350px × auto (max 500px)
```

### 7.2 Estados del Popup

```typescript
type PopupState =
  | { status: 'loading' }
  | { status: 'no-datalayer' }
  | { status: 'recording'; data: TabState }
  | { status: 'paused'; data: TabState }
  | { status: 'error'; message: string };
```

### 7.3 Flujo de Datos

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Popup     │ ──▶ │  SW         │ ──▶ │  TabState   │
│   Opens     │     │  Request    │     │  Response   │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                                │
                           ┌────────────────────┘
                           ▼
                    ┌─────────────┐
                    │   Render    │
                    │   State     │
                    └─────────────┘
                           │
                           ▼ (port for real-time)
                    ┌─────────────┐
                    │  NEW_EVENT  │ ──▶ Update counter
                    └─────────────┘
```

---

## 8. Sistema de Mensajes

### 8.1 Tipos de Mensajes (Completo)

```typescript
// src/shared/types/messages.ts

// ===== Page → Content =====
export type PageToContentMessage =
  | {
      source: '__DATALAYER_INSPECTOR__';
      type: 'DL_EVENT_CAPTURED';
      payload: {
        id: string;
        timestamp: number;
        url: string;
        eventName: string | null;
        data: Record<string, unknown>;
        containerIds: string[];
        sourceName: string;
        index: number;
      };
    }
  | {
      source: '__DATALAYER_INSPECTOR__';
      type: 'DL_CONTAINERS_DETECTED';
      payload: {
        containers: Array<{ id: string; dataLayerName: string }>;
      };
    }
  | {
      source: '__DATALAYER_INSPECTOR__';
      type: 'DL_INITIALIZED';
      payload: {
        dataLayerNames: string[];
        existingEventsCount: number;
      };
    };

// ===== Content → Background =====
export type ContentToBackgroundMessage =
  | { type: 'DL_EVENT'; payload: PageToContentMessage['payload'] }
  | { type: 'DL_CONTAINERS'; payload: { containers: Array<{ id: string; dataLayerName: string }> } }
  | { type: 'DL_INIT'; payload: { dataLayerNames: string[]; existingEventsCount: number } };

// ===== Background → Client (via Port) =====
export type BackgroundToClientMessage =
  | { type: 'NEW_EVENT'; payload: DataLayerEvent }
  | { type: 'CONTAINERS_UPDATED'; payload: { containers: string[] } }
  | { type: 'TAB_STATE_RESET'; payload: { tabId: number; reason: 'navigation' | 'cleared' | 'tab-closed' } }
  | { type: 'RECORDING_CHANGED'; payload: { isRecording: boolean } };

// ===== Client → Background (Request/Response) =====
export type ClientToBackgroundRequest =
  | { type: 'GET_EVENTS'; payload: { tabId: number } }
  | { type: 'GET_CONTAINERS'; payload: { tabId: number } }
  | { type: 'GET_TAB_STATE'; payload: { tabId: number } }
  | { type: 'CLEAR_EVENTS'; payload: { tabId: number } }
  | { type: 'SET_RECORDING'; payload: { tabId: number; isRecording: boolean } }
  | { type: 'GET_SETTINGS' }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<UserSettings> };

export type ClientToBackgroundResponse =
  | { type: 'EVENTS'; payload: { events: DataLayerEvent[] } }
  | { type: 'CONTAINERS'; payload: { containers: string[] } }
  | { type: 'TAB_STATE'; payload: TabState | null }
  | { type: 'SETTINGS'; payload: UserSettings }
  | { type: 'OK' }
  | { type: 'ERROR'; payload: { message: string } };
```

### 8.2 Validadores de Mensajes

```typescript
// src/shared/validators/message-validators.ts

import { MESSAGE_SOURCE } from '../constants';
import type { PageToContentMessage } from '../types/messages';

export function isValidPageToContentMessage(data: unknown): data is PageToContentMessage {
  if (!data || typeof data !== 'object') return false;
  
  const msg = data as Record<string, unknown>;
  
  if (msg.source !== MESSAGE_SOURCE) return false;
  
  const validTypes = ['DL_EVENT_CAPTURED', 'DL_CONTAINERS_DETECTED', 'DL_INITIALIZED'];
  if (!validTypes.includes(msg.type as string)) return false;
  
  if (!msg.payload || typeof msg.payload !== 'object') return false;
  
  return true;
}

export function isValidContentToBackgroundMessage(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  
  const msg = data as Record<string, unknown>;
  const validTypes = ['DL_EVENT', 'DL_CONTAINERS', 'DL_INIT'];
  
  return validTypes.includes(msg.type as string) && msg.payload !== undefined;
}
```

---

## 9. Gestión de Estado

### 9.1 Diagrama de Estado Global

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ESTADO DE LA EXTENSIÓN                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Service Worker (Autoridad)                                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  tabStates: Map<tabId, TabState>                             │    │
│  │  ├── tabId: 123                                              │    │
│  │  │   ├── events: DataLayerEvent[]                            │    │
│  │  │   ├── containers: string[]                                │    │
│  │  │   ├── isRecording: boolean                                │    │
│  │  │   └── nextIndex: number                                   │    │
│  │  └── tabId: 456                                              │    │
│  │      └── ...                                                 │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                           │                                          │
│         ┌─────────────────┼─────────────────┐                       │
│         ▼                 ▼                 ▼                       │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐               │
│  │  Panel 123  │   │  Panel 456  │   │   Popup     │               │
│  │  (mirror)   │   │  (mirror)   │   │  (mirror)   │               │
│  │             │   │             │   │             │               │
│  │  Zustand    │   │  Zustand    │   │  useState   │               │
│  │  Store      │   │  Store      │   │             │               │
│  └─────────────┘   └─────────────┘   └─────────────┘               │
│                                                                      │
│  Flujo: SW es la fuente, Panel/Popup son mirrors sincronizados      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.2 Sincronización de Estado

```
Evento nuevo llega:

Page Script ──postMessage──▶ Content Script ──sendMessage──▶ Service Worker
                                                                    │
                                                            tabManager.addEvent()
                                                                    │
                                                            portManager.broadcast()
                                                                    │
                            ┌───────────────────────────────────────┤
                            ▼                                       ▼
                      Panel (port)                            Popup (port)
                            │                                       │
                      store.addEvent()                        setState()
                            │                                       │
                      React re-render                         React re-render
```

---

## 10. Persistencia

### 10.1 Capas de Storage

| Storage | Contenido | Límite | Persiste |
|---------|-----------|--------|----------|
| `chrome.storage.session` | TabState (backup) | ~10MB | No (solo sesión browser) |
| `chrome.storage.sync` | UserSettings | 100KB | Sí (cross-device) |
| `chrome.storage.local` | Schemas (F2) | ~10MB | Sí (local only) |
| **Memoria SW** | TabState (primary) | N/A | No (se pierde al suspender) |

### 10.2 Estrategia de Persistencia

```typescript
// src/background/storage.ts

export class StorageManager {
  private writeTimeout: number | null = null;
  private readonly DEBOUNCE_MS = 500;
  
  constructor(private tabManager: TabManager) {}
  
  // Debounced write
  persist(): void {
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }
    
    this.writeTimeout = setTimeout(() => {
      this.writeToStorage();
    }, this.DEBOUNCE_MS);
  }
  
  private async writeToStorage(): Promise<void> {
    const data = this.tabManager.serialize();
    
    // Truncar eventos si excede límite
    const serialized = JSON.stringify(data);
    if (serialized.length > 5_000_000) { // 5MB limit
      // Truncar eventos más viejos
      for (const tabId in data) {
        data[tabId].events = data[tabId].events.slice(-100);
      }
    }
    
    await chrome.storage.session.set({ tabStates: data });
  }
  
  async hydrate(): Promise<void> {
    const result = await chrome.storage.session.get('tabStates');
    if (result.tabStates) {
      this.tabManager.hydrate(result.tabStates);
    }
  }
}
```

---

## 11. Decisiones de Diseño

### 11.1 Decisiones Clave

| Decisión | Alternativas Consideradas | Razón de Elección |
|----------|---------------------------|-------------------|
| **Monkey-patch push** | Proxy, MutationObserver | Menor overhead, compatible con GTM |
| **Zustand vs Redux** | Redux, Jotai, Context | Mínimo boilerplate, buen soporte TS |
| **Port vs sendMessage** | Solo sendMessage | Port mantiene SW vivo, streaming eficiente |
| **React Window** | Virtuoso, sin virtualización | Balance tamaño/features, well-maintained |
| **Storage.session** | IndexedDB, localStorage | API simple, suficiente para el caso de uso |

### 11.2 Trade-offs Aceptados

| Trade-off | Beneficio | Costo |
|-----------|-----------|-------|
| SW se suspende | Menor uso de recursos | Posible pérdida de eventos (mitigado con storage) |
| Content script stateless | Simplicidad, menos bugs | Overhead de mensajes |
| Eventos en memoria primero | Baja latencia | Límite de ~500 eventos por tab |
| No usar DataLayerHelper en F1 | Bundle más pequeño | Implementar merge manual para snapshots (F2) |

---

## 12. Diagramas

### 12.1 Secuencia: Captura de Evento

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Page   │     │ Page    │     │ Content │     │ Service │     │ DevTools│
│  (GTM)  │     │ Script  │     │ Script  │     │ Worker  │     │ Panel   │
└────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
     │               │               │               │               │
     │ dataLayer.push({event:'x'})   │               │               │
     │──────────────▶│               │               │               │
     │               │               │               │               │
     │               │ postMessage   │               │               │
     │               │ DL_EVENT_CAPTURED             │               │
     │               │──────────────▶│               │               │
     │               │               │               │               │
     │               │               │ sendMessage   │               │
     │               │               │ DL_EVENT      │               │
     │               │               │──────────────▶│               │
     │               │               │               │               │
     │               │               │               │ addEvent()    │
     │               │               │               │───────┐       │
     │               │               │               │       │       │
     │               │               │               │◀──────┘       │
     │               │               │               │               │
     │               │               │               │ port.postMessage
     │               │               │               │ NEW_EVENT     │
     │               │               │               │──────────────▶│
     │               │               │               │               │
     │               │               │               │               │ render
     │               │               │               │               │────┐
     │               │               │               │               │    │
     │               │               │               │               │◀───┘
     │               │               │               │               │
```

### 12.2 Secuencia: Reconexión tras Suspensión

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ DevTools│     │ Service │     │ Storage │
│ Panel   │     │ Worker  │     │ Session │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     │ (SW suspended)│               │
     │               X               │
     │               │               │
     │ port.disconnect event         │
     │◀──────────────│               │
     │               │               │
     │ reconnect     │               │
     │ (1s delay)    │               │
     │───────┐       │               │
     │       │       │               │
     │◀──────┘       │               │
     │               │               │
     │ connect()     │               │
     │──────────────▶│ (SW wakes up) │
     │               │               │
     │               │ hydrate()     │
     │               │──────────────▶│
     │               │               │
     │               │ tabStates     │
     │               │◀──────────────│
     │               │               │
     │ GET_TAB_STATE │               │
     │──────────────▶│               │
     │               │               │
     │ TAB_STATE     │               │
     │◀──────────────│               │
     │               │               │
     │ (UI restored) │               │
     │               │               │
```

### 12.3 Component Diagram (DevTools Panel)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DevTools Panel                                 │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                           App.tsx                                 │   │
│  │                                                                   │   │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │   │
│  │   │useConnection│───▶│ Zustand     │◀───│ Components          │  │   │
│  │   │   Hook      │    │ Store       │    │                     │  │   │
│  │   └─────────────┘    └──────┬──────┘    │ ┌─────────────────┐ │  │   │
│  │                             │           │ │    Toolbar      │ │  │   │
│  │                             │           │ ├─────────────────┤ │  │   │
│  │                    ┌────────┴────────┐  │ │   SearchBar     │ │  │   │
│  │                    │   Selectors     │  │ ├─────────────────┤ │  │   │
│  │                    │                 │  │ │   SplitPane     │ │  │   │
│  │                    │ filteredEvents  │──┼▶│ ├── EventList   │ │  │   │
│  │                    │ selectedEvent   │──┼▶│ └── DetailView  │ │  │   │
│  │                    │ eventStats      │──┼▶│                 │ │  │   │
│  │                    └─────────────────┘  │ └─────────────────┘ │  │   │
│  │                                         └─────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                           lib/                                    │   │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │   │
│  │   │  search.ts  │    │json-tree.ts │    │     format.ts       │  │   │
│  │   │             │    │             │    │                     │  │   │
│  │   │searchEvents │    │ getNodeType │    │ formatTimestamp     │  │   │
│  │   │highlightMat │    │ flattenTree │    │ formatEventName     │  │   │
│  │   └─────────────┘    └─────────────┘    └─────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 13. Fase 2 — Diseño de Features

### 13.1 Export Evidence Image (Feature 2.5)

Genera capturas PNG o documentos PDF con los eventos del dataLayer para documentación de QA.

#### Arquitectura

```
┌──────────────────────────────────────────────────────────────────┐
│                     DevTools Panel                                │
│                                                                   │
│  ┌─────────────────┐    ┌─────────────────┐                      │
│  │ ExportEvidence  │───▶│ EvidenceDialog  │                      │
│  │ Button          │    │ (options modal)  │                      │
│  └─────────────────┘    └────────┬────────┘                      │
│                                  │                                │
│                                  ▼                                │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │                   evidence-generator.ts                    │   │
│  │                                                            │   │
│  │  ┌──────────────┐    ┌──────────────┐    ┌─────────────┐  │   │
│  │  │ buildLayout  │───▶│ renderToPNG  │───▶│ download    │  │   │
│  │  │ (HTML/CSS)   │    │ (html2canvas) │    │ (blob→file)│  │   │
│  │  └──────────────┘    └──────────────┘    └─────────────┘  │   │
│  │         │                                                  │   │
│  │         │            ┌──────────────┐    ┌─────────────┐  │   │
│  │         └───────────▶│ renderToPDF  │───▶│ download    │  │   │
│  │                      │ (jspdf)      │    │ (blob→file)│  │   │
│  │                      └──────────────┘    └─────────────┘  │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

#### Dependencias

| Librería | Uso | Size (gzip) |
|----------|-----|-------------|
| `html2canvas` | Renderizar HTML a canvas para PNG | ~40KB |
| `jspdf` | Generar PDF | ~90KB |

> **Nota**: Ambas librerías se cargan lazy (dynamic import) para no afectar el bundle de Fase 1.

#### Componentes

```
src/devtools/panel/
├── components/
│   └── export/
│       ├── ExportEvidenceButton.tsx   # Trigger button en toolbar
│       ├── EvidenceDialog.tsx         # Modal de opciones
│       ├── EvidencePreview.tsx        # Vista previa del evidence
│       └── EvidenceLayout.tsx         # Template del documento
└── lib/
    └── evidence/
        ├── index.ts                   # Public API
        ├── generator.ts               # Lógica principal
        ├── layout.ts                  # Construir HTML del documento
        ├── renderers/
        │   ├── png.ts                 # html2canvas wrapper
        │   └── pdf.ts                 # jspdf wrapper
        └── templates/
            ├── light.css              # Estilos tema claro
            └── dark.css               # Estilos tema oscuro
```

#### Flujo

```typescript
// 1. Usuario hace click en "Export Evidence"
// 2. Se abre EvidenceDialog con opciones

// 3. Al confirmar, se ejecuta:
async function exportEvidence(options: ExportEvidenceOptions): Promise<void> {
  // a. Obtener eventos del store
  const events = options.eventIds.length > 0
    ? selectEventsByIds(options.eventIds)
    : selectFilteredEvents();
  
  // b. Construir metadata
  const metadata = buildMetadata(options);
  
  // c. Crear documento
  const document: EvidenceDocument = {
    metadata,
    events: events.map(enrichWithValidation),
    summary: computeSummary(events),
  };
  
  // d. Generar output según formato
  if (options.format === 'png') {
    const blob = await renderToPNG(document, options);
    downloadBlob(blob, `strata-evidence-${Date.now()}.png`);
  } else {
    const blob = await renderToPDF(document, options);
    downloadBlob(blob, `strata-evidence-${Date.now()}.pdf`);
  }
}
```

#### Layout del Evidence

```
┌─────────────────────────────────────────────────────────────┐
│  STRATA — DataLayer Evidence                                │
│                                                              │
│  Page: https://example.com/checkout                         │
│  Generated: 2026-03-15 14:30:22                             │
│  Project: Acme E-commerce                                    │
│  Events: 12 captured | 10 valid | 2 invalid                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  #1 | gtm.js | 14:30:01.234                           ✓     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ { "event": "gtm.js", "gtm.start": 1710512... }     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  #2 | page_view | 14:30:01.456                        ✓     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ { "event": "page_view", "page_title": "Check..." } │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  #3 | add_to_cart | 14:30:05.789                      ✗     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ { "event": "add_to_cart", ... }                    │    │
│  │ ⚠ Missing required field: currency                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Consideraciones de Performance

- El rendering se hace off-screen para no bloquear UI
- Para >50 eventos, se muestra "Large export" warning
- PDF usa compresión de imágenes
- PNG se escala a max 4000px de ancho

---

## Apéndice A — Checklist de Implementación

### Fase 1

- [ ] **Setup**
  - [ ] Vite + CRXJS configurado
  - [ ] TypeScript strict mode
  - [ ] Tailwind CSS 4
  - [ ] ESLint + Prettier
  - [ ] Vitest + Playwright

- [ ] **Page Script**
  - [ ] interceptor.ts
  - [ ] container-detector.ts
  - [ ] message-emitter.ts
  - [ ] Unit tests (TC-PAGE-*)

- [ ] **Content Script**
  - [ ] injector.ts
  - [ ] relay.ts
  - [ ] Integration tests

- [ ] **Service Worker**
  - [ ] tab-manager.ts + tests
  - [ ] port-manager.ts + tests
  - [ ] message-handler.ts
  - [ ] storage.ts + tests
  - [ ] index.ts (bootstrap)

- [ ] **DevTools Panel**
  - [ ] Zustand store
  - [ ] useConnection hook
  - [ ] EventList + virtualización
  - [ ] JsonTreeView
  - [ ] JsonRawView
  - [ ] SearchBar + search engine
  - [ ] Toolbar
  - [ ] Keyboard shortcuts

- [ ] **Popup**
  - [ ] Layout básico
  - [ ] Conexión con SW
  - [ ] Estados (loading, no-dl, recording)

- [ ] **Shared**
  - [ ] Tipos completos
  - [ ] Message validators
  - [ ] Constants

### Fase 2

- [ ] Schema validation engine
- [ ] Diff engine
- [ ] Test code generator
- [ ] Export JSON
- [ ] Export Evidence Image (Feature 2.5)
- [ ] Snapshot management
