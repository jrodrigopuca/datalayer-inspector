# Strata — Technical Specification

> Basado en [PLAN.md](./PLAN.md) y [RESEARCH.md](./RESEARCH.md) — Marzo 2026

## 1. Resumen

Strata es una extensión de Chrome (MV3-native) que captura, inspecciona, valida y exporta el `dataLayer` de Google Tag Manager. La extensión opera a través de 4 contextos de ejecución con comunicación asíncrona entre ellos.

Este documento es la **especificación técnica de implementación**. Define interfaces, protocolos de mensajes, contratos entre componentes, esquemas de almacenamiento y restricciones de rendimiento.

---

## 2. Contextos de Ejecución

Chrome Extensions corren en contextos aislados. Cada uno tiene acceso a APIs distintas:

| Contexto           | Acceso a DOM | Acceso a `window` de la página | APIs Chrome                          | Persistencia  |
| ------------------ | ------------ | ------------------------------ | ------------------------------------ | ------------- |
| **Page Script**    | ✅            | ✅                              | ❌                                    | ❌ Por navegación |
| **Content Script** | ✅            | ❌ (aislado)                    | `chrome.runtime` (limitado)          | ❌ Por navegación |
| **Service Worker** | ❌            | ❌                              | Todas (excepto DOM)                  | ⚠️ Se suspende |
| **DevTools Panel** | ✅ (propio)   | ❌                              | `chrome.devtools`, `chrome.runtime`  | ❌ Por cierre de DevTools |
| **Popup**          | ✅ (propio)   | ❌                              | `chrome.runtime`, `chrome.tabs`      | ❌ Por cierre de popup |

### 2.1 Restricciones Críticas del Service Worker

El service worker en MV3 se **suspende** tras ~30 segundos de inactividad. Esto implica:

- **NO almacenar estado en variables globales** sin respaldo → usar `chrome.storage.session` como fallback
- Los `Port` de `chrome.runtime.connect` mantienen vivo al SW mientras están abiertos
- DevTools panel debe mantener un port abierto para evitar suspensión mientras está visible
- Al despertar, el SW debe poder reconstruir estado desde `chrome.storage.session`

---

## 3. Manifest

```json
{
  "manifest_version": 3,
  "name": "Strata",
  "version": "0.1.0",
  "description": "Inspect, validate, and export the Google Tag Manager dataLayer",
  "permissions": [
    "activeTab",
    "scripting",
    "storage"
  ],
  "optional_permissions": [
    "tabs"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "src/background/index.ts"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/content/index.ts"],
      "run_at": "document_start"
    }
  ],
  "devtools_page": "src/devtools/devtools.html",
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "src/assets/icons/icon-16.png",
      "32": "src/assets/icons/icon-32.png",
      "48": "src/assets/icons/icon-48.png",
      "128": "src/assets/icons/icon-128.png"
    }
  },
  "icons": {
    "16": "src/assets/icons/icon-16.png",
    "32": "src/assets/icons/icon-32.png",
    "48": "src/assets/icons/icon-48.png",
    "128": "src/assets/icons/icon-128.png"
  }
}
```

> **Nota**: CRXJS transforma los paths de `src/` a los outputs de build automáticamente. Los paths en el manifest apuntan a source, no a dist.

### 3.1 Justificación de Permisos

| Permiso            | Razón                                                    | Obligatorio |
| ------------------ | -------------------------------------------------------- | ----------- |
| `activeTab`        | Acceso al tab activo cuando el usuario interactúa        | Sí          |
| `scripting`        | Inyectar page script programáticamente                   | Sí          |
| `storage`          | Persistir settings y schemas                             | Sí          |
| `tabs`             | Escuchar `onRemoved` para cleanup (pedido al usuario)    | Opcional    |
| `<all_urls>`       | Content script debe correr en cualquier sitio            | Sí          |

---

## 4. Tipos Compartidos (`src/shared/types.ts`)

Todos los tipos que cruzan boundaries entre contextos se definen aquí. Son el **contrato** de la extensión.

### 4.1 Core Types

```typescript
/** Identificador único para cada push al dataLayer */
type EventId = string; // crypto.randomUUID()

/** Representa un único push al dataLayer */
interface DataLayerEvent {
  /** UUID v4 generado en el page script al capturar */
  id: EventId;
  /** Timestamp en ms (Date.now()) del momento del push */
  timestamp: number;
  /** URL completa (location.href) al momento del push */
  url: string;
  /** Valor de la key "event" si existe, null si no */
  eventName: string | null;
  /** Payload completo del push (el objeto pasado a dataLayer.push()) */
  data: Record<string, unknown>;
  /** IDs de containers GTM detectados al momento del push */
  containerIds: string[];
  /** Nombre del array dataLayer de origen ("dataLayer" por defecto) */
  source: string;
  /** Número secuencial del evento en la sesión del tab (1-based) */
  index: number;
}

/** Estado de un tab monitoreado */
interface TabState {
  tabId: number;
  /** Eventos capturados, ordenados por timestamp ASC */
  events: DataLayerEvent[];
  /** GTM containers detectados en el tab */
  containers: string[];
  /** URL actual del tab */
  url: string;
  /** Si la captura está activa */
  isRecording: boolean;
  /** Contador incremental para asignar index a eventos */
  nextIndex: number;
}

/** Container GTM detectado */
interface GTMContainer {
  /** ID del container (ej: "GTM-XXXXXX") */
  id: string;
  /** Nombre del dataLayer asociado */
  dataLayerName: string;
}
```

### 4.2 Settings Types

```typescript
type Theme = "auto" | "dark" | "light";

interface UserSettings {
  /** Tema de la UI */
  theme: Theme;
  /** Nombres de dataLayer arrays a monitorear */
  dataLayerNames: string[];
  /** Auto-scroll al último evento en el timeline */
  autoScroll: boolean;
  /** Máximo de eventos a retener por tab (los más viejos se descartan) */
  maxEventsPerTab: number;
  /** Profundidad de expansión default del JSON tree */
  defaultExpandDepth: number;
}

/** Valores por defecto */
const DEFAULT_SETTINGS: UserSettings = {
  theme: "auto",
  dataLayerNames: ["dataLayer"],
  autoScroll: true,
  maxEventsPerTab: 500,
  defaultExpandDepth: 2,
};
```

### 4.3 Fase 2 — Schema Types

```typescript
type FieldType = "string" | "number" | "boolean" | "array" | "object";

/** Un campo esperado en un evento */
interface SchemaField {
  /** Path en dot notation. Soporta array notation: "ecommerce.items[].item_id" */
  path: string;
  /** Tipo esperado del valor */
  type: FieldType;
  /** Descripción para el usuario */
  description?: string;
}

/** Regla de validación para un tipo de evento */
interface SchemaRule {
  id: string;
  /** Nombre legible para el usuario */
  name: string;
  /** Pattern para hacer match contra eventName. String exacto o regex (marcado con prefijo /) */
  eventPattern: string;
  /** Campos que DEBEN estar presentes */
  required: SchemaField[];
  /** Campos opcionales documentados (warning si faltan) */
  optional: SchemaField[];
  /** Si esta regla está activa */
  enabled: boolean;
}

type ValidationSeverity = "error" | "warning";

/** Resultado de validar un campo */
interface ValidationIssue {
  severity: ValidationSeverity;
  /** Path del campo con el problema */
  fieldPath: string;
  /** Descripción del problema */
  message: string;
  /** Valor esperado (para display) */
  expected?: string;
  /** Valor encontrado (para display) */
  actual?: string;
}

type ValidationStatus = "pass" | "warn" | "fail";

/** Resultado de validar un evento contra todos los schemas */
interface ValidationResult {
  eventId: EventId;
  /** ID de la SchemaRule que matcheó */
  schemaId: string;
  status: ValidationStatus;
  issues: ValidationIssue[];
}
```

### 4.4 Fase 2 — Snapshot & Diff Types

```typescript
/** Snapshot del estado acumulado del dataLayer */
interface DataLayerSnapshot {
  id: string;
  /** Label editable por el usuario */
  label: string;
  /** Timestamp de captura */
  timestamp: number;
  /** URL al momento de captura */
  url: string;
  /** Estado acumulado (merge de todos los pushes hasta este punto) */
  state: Record<string, unknown>;
  /** Índice del último evento incluido en el snapshot */
  lastEventIndex: number;
}

type DiffChangeType = "added" | "removed" | "modified";

/** Un cambio detectado entre dos snapshots */
interface DiffEntry {
  /** Path en dot notation de la key afectada */
  path: string;
  type: DiffChangeType;
  /** Valor en snapshot A (undefined si es "added") */
  oldValue?: unknown;
  /** Valor en snapshot B (undefined si es "removed") */
  newValue?: unknown;
}
```

### 4.5 Fase 2 — Export Types

```typescript
type ExportFormat = "json-raw" | "json-clean";
type TestFramework = "playwright" | "cypress";
type AssertionStyle = "exact" | "type-only";

interface ExportJSONOptions {
  format: ExportFormat;
  /** true = solo exportar eventos que pasen el filtro actual */
  filteredOnly: boolean;
  includeTimestamp: boolean;
  includeUrl: boolean;
}

interface ExportTestOptions {
  framework: TestFramework;
  assertionStyle: AssertionStyle;
  includeNavigation: boolean;
  includeWaits: boolean;
  /** IDs de los eventos seleccionados para export */
  eventIds: EventId[];
}
```

---

## 5. Protocolo de Mensajes

La comunicación entre contextos usa mensajes tipados. Cada mensaje tiene un `type` discriminante que define la forma del `payload`.

### 5.1 Page Script ↔ Content Script

Canal: `window.postMessage` / `window.addEventListener("message")`

Dirección única: Page → Content.

```typescript
/** Identificador para filtrar mensajes propios vs ruido de la página */
const MESSAGE_SOURCE = "__DATALAYER_INSPECTOR__" as const;

/** Mensajes del Page Script al Content Script via window.postMessage */
type PageToContentMessage =
  | {
      source: typeof MESSAGE_SOURCE;
      type: "DL_EVENT_CAPTURED";
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
      source: typeof MESSAGE_SOURCE;
      type: "DL_CONTAINERS_DETECTED";
      payload: {
        containers: GTMContainer[];
      };
    }
  | {
      source: typeof MESSAGE_SOURCE;
      type: "DL_INITIALIZED";
      payload: {
        dataLayerNames: string[];
        existingEventsCount: number;
      };
    };
```

**Seguridad**: El content script DEBE verificar `event.data.source === MESSAGE_SOURCE` antes de procesar cualquier mensaje. Esto filtra mensajes de la página o de otras extensiones.

### 5.2 Content Script ↔ Service Worker

Canal: `chrome.runtime.sendMessage` / `chrome.runtime.onMessage`

Dirección: Content → SW (one-shot per event).

```typescript
/** Mensajes del Content Script al Service Worker */
type ContentToBackgroundMessage =
  | {
      type: "DL_EVENT";
      payload: Omit<DataLayerEvent, "index"> & { index: number };
    }
  | {
      type: "DL_CONTAINERS";
      payload: {
        containers: GTMContainer[];
      };
    }
  | {
      type: "DL_INIT";
      payload: {
        dataLayerNames: string[];
        existingEventsCount: number;
      };
    };
```

### 5.3 Service Worker ↔ DevTools Panel / Popup

Canal: `chrome.runtime.connect` (long-lived port) para streaming en real-time. `chrome.runtime.sendMessage` para request/response.

#### Port-based streaming (SW → Panel)

```typescript
/** Nombre del port para identificar conexiones del DevTools Panel */
const DEVTOOLS_PORT_NAME = "devtools-panel" as const;
const POPUP_PORT_NAME = "popup" as const;

/** Mensajes que el SW envía por el port a listeners conectados */
type BackgroundToClientMessage =
  | {
      type: "NEW_EVENT";
      payload: DataLayerEvent;
    }
  | {
      type: "CONTAINERS_UPDATED";
      payload: {
        containers: string[];
      };
    }
  | {
      type: "TAB_STATE_RESET";
      payload: {
        tabId: number;
        reason: "navigation" | "cleared" | "tab-closed";
      };
    }
  | {
      type: "RECORDING_CHANGED";
      payload: {
        isRecording: boolean;
      };
    };
```

#### Request/Response (Panel/Popup → SW)

```typescript
/** Request del Panel/Popup al SW */
type ClientToBackgroundRequest =
  | { type: "GET_EVENTS"; payload: { tabId: number } }
  | { type: "GET_CONTAINERS"; payload: { tabId: number } }
  | { type: "CLEAR_EVENTS"; payload: { tabId: number } }
  | { type: "SET_RECORDING"; payload: { tabId: number; isRecording: boolean } }
  | { type: "GET_TAB_STATE"; payload: { tabId: number } }
  | { type: "GET_SETTINGS" }
  | { type: "UPDATE_SETTINGS"; payload: Partial<UserSettings> };

/** Response del SW al Panel/Popup */
type ClientToBackgroundResponse =
  | { type: "EVENTS"; payload: { events: DataLayerEvent[] } }
  | { type: "CONTAINERS"; payload: { containers: string[] } }
  | { type: "TAB_STATE"; payload: TabState | null }
  | { type: "SETTINGS"; payload: UserSettings }
  | { type: "OK" }
  | { type: "ERROR"; payload: { message: string } };
```

### 5.4 Diagrama Completo del Protocolo

```
Page Script                Content Script              Service Worker              DevTools Panel
    │                           │                           │                           │
    │ DL_EVENT_CAPTURED         │                           │                           │
    │──── postMessage ─────────▶│                           │                           │
    │                           │ DL_EVENT                  │                           │
    │                           │──── sendMessage ─────────▶│                           │
    │                           │                           │ NEW_EVENT                 │
    │                           │                           │──── port.postMessage ────▶│
    │                           │                           │                           │
    │                           │                           │◀── GET_EVENTS ────────────│
    │                           │                           │──── EVENTS ──────────────▶│
    │                           │                           │                           │
    │                           │                           │◀── CLEAR_EVENTS ──────────│
    │                           │                           │──── OK ──────────────────▶│
    │                           │                           │──── TAB_STATE_RESET ─────▶│
```

---

## 6. Page Script — Spec Detallado

**Archivo**: `src/page/index.ts`
**Contexto**: Se ejecuta en el contexto de la página (acceso a `window`).
**Inyección**: El content script lo inyecta como `<script>` en `document_start`.

### 6.1 Responsabilidades

1. Detectar e interceptar arrays dataLayer
2. Capturar cada push con metadata completa
3. Detectar containers GTM
4. Enviar datos al content script via `postMessage`

### 6.2 Interceptación del DataLayer

```
Estrategia: Monkey-patch de Array.prototype.push en la instancia específica.
```

**Flujo de inicialización**:

1. Leer configuración de dataLayer names desde un `data-attribute` inyectado por el content script
2. Para cada nombre configurado (`"dataLayer"` por defecto):
   a. Si `window[name]` existe → interceptar inmediatamente
   b. Si no existe → definir setter en `window` que intercepte cuando se cree
3. Enviar mensaje `DL_INITIALIZED` al content script

**Interceptación de push**:

```
Para cada array detectado:
1. Guardar referencia al push original
2. Reemplazar .push() con wrapper que:
   a. Llama al push original (para no romper GTM)
   b. Para cada argumento:
      - Genera UUID (crypto.randomUUID())
      - Captura timestamp (Date.now())
      - Captura URL (location.href)
      - Extrae eventName (data.event || null)
      - Detecta containers via window.google_tag_manager
      - Envía DL_EVENT_CAPTURED al content script
   c. Retorna el resultado del push original
3. Procesar eventos existentes en el array (los push anteriores a la inyección)
```

### 6.3 Detección de Containers GTM

```
Containers se detectan inspeccionando:
1. window.google_tag_manager — objeto con keys como "GTM-XXXXXX"
2. Los keys cuyo valor tenga .dataLayer definido

Polling strategy:
- Chequear al inicializar
- Re-chequear cuando llega un push con event "gtm.js" (señal de que GTM cargó)
- NO hacer polling periódico (evitar overhead)
```

### 6.4 Procesamiento de Eventos Existentes

Cuando el page script se inyecta DESPUÉS de que ya hubo pushes:

```
1. Leer window[dataLayerName] (es un Array)
2. Para cada elemento existente, emitir DL_EVENT_CAPTURED con:
   - timestamp: 0 (indica "previo a inyección")
   - url: location.href (no se puede saber la URL original)
   - eventName: element.event || null
3. Enviar en orden, respetando el índice original
```

### 6.5 Protecciones

- **No-throw**: Todo el código wrapeado en try/catch. Un error en la extensión NUNCA debe romper la página.
- **No pollution**: No agregar propiedades a `window` excepto el wrapper de push. Usar closure scope.
- **Idempotencia**: Si el script se inyecta dos veces, detectar y no duplicar el wrapper.
- **Cleanup**: No necesario (el script vive mientras la página viva).

---

## 7. Content Script — Spec Detallado

**Archivo**: `src/content/index.ts`
**Contexto**: Aislado. Acceso a DOM pero NO a `window` de la página.
**Ejecución**: `document_start` (antes de que scripts de la página corran).

### 7.1 Responsabilidades

1. Inyectar el page script en el contexto de la página
2. Escuchar mensajes del page script
3. Retransmitir mensajes al service worker

### 7.2 Inyección del Page Script

```
Estrategia: Crear <script> tag con src apuntando al archivo del page script.

1. Crear un <script> element
2. Setear src = chrome.runtime.getURL("src/page/index.ts")
   (CRXJS expone archivos listados en web_accessible_resources)
3. Opcionalmente setear data-config con JSON de dataLayerNames
4. Append to document.documentElement (no esperar a <head>/<body>)
5. Remover el <script> tag después de ejecución (cleanup cosmético)
```

**¿Por qué `<script src>` y no inline?** MV3 CSP prohíbe `eval()` e inline scripts en content scripts. Usar `chrome.runtime.getURL` para un archivo estático es la forma correcta.

### 7.3 Message Relay

```typescript
// Patrón de filtrado
window.addEventListener("message", (event) => {
  // Solo mensajes de nuestra propia ventana
  if (event.source !== window) return;
  // Solo mensajes nuestros
  if (event.data?.source !== MESSAGE_SOURCE) return;

  // Retransmitir al service worker
  chrome.runtime.sendMessage({
    type: mapType(event.data.type),
    payload: event.data.payload,
  });
});
```

### 7.4 Protecciones

- **Filter origin**: Solo procesar mensajes de `window` con nuestro `MESSAGE_SOURCE`
- **Fire and forget**: No esperar respuesta del SW (evitar promesas colgadas si SW está dormido)
- **No state**: El content script no mantiene estado. Es un relay puro.

---

## 8. Service Worker — Spec Detallado

**Archivo**: `src/background/index.ts`
**Contexto**: Extensión. Sin acceso a DOM. Se suspende tras inactividad.

### 8.1 Responsabilidades

1. Almacenar estado por tab (eventos, containers, recording state)
2. Recibir eventos de content scripts
3. Broadcast a DevTools panels y popups conectados
4. Responder a requests de panels/popups
5. Gestionar ciclo de vida de tabs (abrir, navegar, cerrar)

### 8.2 Estado en Memoria

```typescript
/** Mapa principal de estado. Key = tabId. */
const tabStates = new Map<number, TabState>();

/** Ports conectados. Key = tabId, value = set de ports. */
const connectedPorts = new Map<number, Set<chrome.runtime.Port>>();
```

### 8.3 Persistencia y Wake-up

```
El SW puede ser suspendido en cualquier momento tras ~30s de inactividad.

Estrategia de persistencia:
1. Cada vez que tabStates cambia, serializar a chrome.storage.session
   (storage.session tiene límite de ~10MB y NO persiste entre reinicios del browser)
2. Al despertar (inicio del SW), leer chrome.storage.session y reconstruir tabStates
3. Los ports se pierden al suspenderse — los clientes deben reconectar

Debounce del write a storage.session:
- Escribir máximo 1 vez cada 500ms
- Usar un writeQueue que acumula cambios
```

### 8.4 Gestión de Tabs

```
chrome.tabs.onRemoved → eliminar tabStates[tabId], limpiar ports
chrome.webNavigation.onCommitted → (main_frame only):
  - Limpiar eventos del tab (nuevo pageload)
  - Actualizar URL
  - Notificar panels: TAB_STATE_RESET con reason "navigation"
  - Mantener containers (se re-detectarán)

chrome.webNavigation.onBeforeNavigate → (main_frame only):
  - Marcar timestamp de navegación para correcta atribución
```

### 8.5 Port Management

```
chrome.runtime.onConnect:
1. Verificar port.name es DEVTOOLS_PORT_NAME o POPUP_PORT_NAME
2. Extraer tabId:
   - DevTools: port.sender no tiene tabId. El panel envía un mensaje
     inicial { type: "INIT", tabId } usando chrome.devtools.inspectedWindow.tabId
   - Popup: obtener tab activo via chrome.tabs.query()
3. Agregar port al set de connectedPorts[tabId]
4. Enviar estado actual (eventos existentes) inmediatamente

port.onDisconnect:
1. Remover de connectedPorts[tabId]
2. Si el set queda vacío, borrar la entry
```

### 8.6 Event Processing Pipeline

```
Recibir DL_EVENT de content script:
1. Extraer tabId del sender: sender.tab.id
2. Obtener o crear TabState para ese tabId
3. Si !isRecording → ignorar
4. Construir DataLayerEvent completo (asignar index secuencial)
5. Append a events[]
6. Si events.length > maxEventsPerTab → shift (FIFO)
7. Broadcast NEW_EVENT a todos los ports en connectedPorts[tabId]
8. Debounce write a chrome.storage.session
```

---

## 9. DevTools Panel — Spec Detallado

### 9.1 DevTools Entry Point

**Archivo**: `src/devtools/devtools.ts`

```typescript
chrome.devtools.panels.create(
  "DataLayer",            // título del tab
  "icons/icon-32.png",    // icono
  "src/devtools/panel.html" // URL del panel
);
```

El nombre del panel es **"DataLayer"** (corto, visible en la barra de DevTools).

### 9.2 Panel Application

**Archivo**: `src/devtools/panel/App.tsx`
**Framework**: React 19 + Zustand

#### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Toolbar                                                      │
│ [🔴 Record] [🗑 Clear] [📊 42 events] [GTM-XX] [⚙ Settings]│
│ [🔍 Search...                              ] [Filter ▾]     │
├──────────────────────┬──────────────────────────────────────┤
│ Event List           │ Detail View                          │
│                      │                                      │
│ 10:30:01.123         │ ┌─ Breadcrumb: root > ecommerce     │
│   page_view     📦   │ │                                    │
│                      │ │ [Tree] [Raw]                       │
│ 10:30:02.456         │ │                                    │
│ ▶ add_to_cart   📦   │ │ ▾ event: "add_to_cart"             │
│                      │ │ ▾ ecommerce:                       │
│ 10:30:05.789         │ │   ▾ items: Array(1)                │
│   purchase      📦   │ │     ▾ 0:                           │
│                      │ │       item_id: "SKU-123"           │
│ (auto-scroll ↓)      │ │       item_name: "Widget"          │
│                      │ │       price: 29.99                  │
└──────────────────────┴──────────────────────────────────────┘
```

**Proporciones**: Event List = 30% width (min 200px), Detail View = 70%. Resizable con drag handle.

#### Dimensiones Mínimas

- Panel ancho mínimo: 400px (Chrome DevTools lo controla, pero el layout debe ser usable)
- Event list height: virtualizado (ver sección de Performance)
- Detail view: scroll vertical para JSON trees grandes

### 9.3 Zustand Store

```typescript
interface PanelStore {
  // --- State ---
  events: DataLayerEvent[];
  selectedEventId: EventId | null;
  containers: string[];
  isRecording: boolean;
  searchQuery: string;
  filters: EventFilters;
  settings: UserSettings;
  viewMode: "tree" | "raw";

  // --- Computed (derivado, no almacenado) ---
  // filteredEvents → computed con selector
  // selectedEvent → computed con selector

  // --- Actions ---
  addEvent: (event: DataLayerEvent) => void;
  selectEvent: (id: EventId | null) => void;
  clearEvents: () => void;
  setRecording: (isRecording: boolean) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<EventFilters>) => void;
  setViewMode: (mode: "tree" | "raw") => void;
  setSettings: (settings: Partial<UserSettings>) => void;

  // --- Fase 2 ---
  schemas: SchemaRule[];
  validationResults: Map<EventId, ValidationResult[]>;
  snapshots: DataLayerSnapshot[];
}

interface EventFilters {
  eventNames: string[];       // vacío = sin filtro
  containers: string[];       // vacío = sin filtro
  timeRange: {                // null = sin filtro
    from: number;
    to: number;
  } | null;
}
```

### 9.4 Event List Component

**Virtualización**: Usar `react-window` o equivalente para renderizar solo los eventos visibles. Con 500 eventos de hasta 2KB c/u, renderizar todo el DOM no es viable.

**Cada item del event list muestra**:

| Elemento        | Spec                                                       |
| --------------- | ---------------------------------------------------------- |
| Timestamp       | `HH:MM:SS.mmm` (hora local, 12 chars)                     |
| Event name      | `eventName` o `"(push)"` si es null. Truncar a 24 chars.  |
| Source badge    | Solo si hay múltiples sources. Texto del `source`.         |
| Validation icon | Fase 2. ✅ / ⚠️ / ❌ según validación.                     |
| Selected state  | Background highlight cuando seleccionado.                  |

**Color coding** (borde izquierdo o background sutil):

| Tipo                           | Color     | Condición                                      |
| ------------------------------ | --------- | ---------------------------------------------- |
| Events estándar                | `blue`    | `eventName !== null`                            |
| Push sin event name            | `gray`    | `eventName === null`                            |
| Ecommerce                      | `green`   | `data.ecommerce` existe                         |
| Error/Exception                | `red`     | `eventName` contiene "error" o "exception"      |
| GTM internal                   | `dimmed`  | `eventName` empieza con "gtm."                  |

### 9.5 JSON Tree View Component

**Requisitos**:

- Expandir/colapsar nodos (click en arrow o double-click en key)
- Expand depth configurable (default: 2 niveles)
- Syntax highlighting por tipo de valor:

| Tipo      | Color token         |
| --------- | ------------------- |
| string    | `--color-string`    |
| number    | `--color-number`    |
| boolean   | `--color-boolean`   |
| null      | `--color-null`      |
| key       | `--color-key`       |
| bracket   | `--color-bracket`   |

- Arrays muestran badge con length: `items: Array(3) ▸`
- Objects muestran badge con key count: `ecommerce: {3 keys} ▸`
- Valores largos (strings > 100 chars) se truncan con "..." y tooltip
- Copy value on click (con toast feedback)
- Breadcrumb de navegación al seleccionar un nodo profundo

### 9.6 Raw JSON View

- Texto formateado con `JSON.stringify(data, null, 2)`
- Syntax highlighting (mismos colores que tree view)
- Botón "Copy" que copia el JSON completo
- Monospace font. Scroll horizontal para líneas largas.
- Line numbers (opcional, off by default)

### 9.7 Search Implementation

```
Algoritmo de búsqueda:
1. Tokenizar query (split por espacios, cada token es un AND)
2. Para cada evento, serializar a JSON string (cachear)
3. Match: todos los tokens deben aparecer en el JSON string (case-insensitive)
4. Highlight: en tree view, resaltar nodos cuya key o value contengan algún token

Performance:
- Debounce input: 300ms
- Cachear JSON strings (invalidar cuando events cambian)
- Search es síncrono (500 eventos * ~2KB = ~1MB de strings, búsqueda < 10ms)
```

### 9.8 Keyboard Shortcuts

| Shortcut                              | Acción                       | Contexto        |
| ------------------------------------- | ---------------------------- | --------------- |
| `Cmd+F` / `Ctrl+F`                   | Focus en search bar          | Panel           |
| `Escape`                              | Limpiar búsqueda / deselect  | Panel           |
| `↑` / `↓`                            | Navegar entre eventos        | Event List      |
| `Enter`                               | Toggle expand evento         | Event List      |
| `Cmd+Shift+C` / `Ctrl+Shift+C`       | Copiar evento seleccionado   | Detail View     |
| `Cmd+Shift+E` / `Ctrl+Shift+E`       | Export JSON (Fase 2)         | Panel           |
| `Cmd+Shift+T` / `Ctrl+Shift+T`       | Export Tests (Fase 2)        | Panel           |

---

## 10. Popup — Spec Detallado

**Archivo**: `src/popup/App.tsx`
**Tamaño**: 350px wide × auto height (max 500px)

### 10.1 Layout

```
┌─────────────────────────────────┐
│ Strata                       ⚙  │
├─────────────────────────────────┤
│                                 │
│  📊 42 events captured          │
│                                 │
│  Containers:                    │
│  [GTM-XXXXX] [GTM-YYYYY]       │
│                                 │
│  Last event:                    │
│  ┌─ purchase (10:30:05)         │
│  │  transaction_id: "T-123"     │
│  │  value: 59.98                │
│  └──────────────────────────    │
│                                 │
│  [Open in DevTools]             │
│                                 │
├─────────────────────────────────┤
│  No dataLayer detected          │
│  (state when nothing found)     │
└─────────────────────────────────┘
```

### 10.2 Estados

| Estado              | Presentación                                       |
| ------------------- | -------------------------------------------------- |
| Sin dataLayer       | Mensaje "No dataLayer detected on this page"       |
| Con eventos         | Contador + último evento (JSON truncado a 3 keys)  |
| Recording pausado   | Badge "Paused" en rojo                              |

### 10.3 Comunicación

1. Al abrir, el popup obtiene el tab activo via `chrome.tabs.query({ active: true, currentWindow: true })`
2. Envía `GET_TAB_STATE` al service worker con el `tabId`
3. Abre un port (`POPUP_PORT_NAME`) para recibir updates en real-time mientras esté abierto
4. Al cerrar, el port se desconecta automáticamente

---

## 11. Almacenamiento

### 11.1 chrome.storage.sync (Settings)

Sincronizado entre dispositivos del usuario. Límite: 100KB total, 8KB por item.

```
Key: "settings"
Value: UserSettings (serialized JSON)
```

### 11.2 chrome.storage.session (Tab State)

Solo en memoria, se pierde al cerrar el browser. Límite: ~10MB. No sincroniza.

```
Key: "tabState:{tabId}"
Value: TabState (serialized JSON, sin el campo events si excede tamaño)
Note: events se mantienen solo en memoria del SW como primera fuente de verdad.
      storage.session es un fallback para wake-up del SW.
```

### 11.3 chrome.storage.local (Schemas — Fase 2)

Persistente en el dispositivo. Límite: ~10MB.

```
Key: "schemas"
Value: SchemaRule[] (serialized JSON)

Key: "schemaPresets"
Value: Record<string, SchemaRule[]> (presets built-in, versionados)
```

---

## 12. Theming

### 12.1 Estrategia

Usar CSS custom properties (design tokens) que cambian según el tema. Tailwind CSS 4 soporta esto nativamente con `@theme`.

### 12.2 Token Map

```css
:root {
  /* Surface colors */
  --surface-primary: ...;
  --surface-secondary: ...;
  --surface-hover: ...;
  --surface-selected: ...;

  /* Text colors */
  --text-primary: ...;
  --text-secondary: ...;
  --text-muted: ...;

  /* Syntax highlighting - JSON viewer */
  --color-string: #22863a;    /* green */
  --color-number: #e36209;    /* orange */
  --color-boolean: #6f42c1;   /* purple */
  --color-null: #6a737d;      /* gray */
  --color-key: #005cc5;       /* blue */
  --color-bracket: #586069;   /* dark gray */

  /* Status colors */
  --color-event-standard: #3b82f6;   /* blue */
  --color-event-ecommerce: #10b981;  /* green */
  --color-event-error: #ef4444;      /* red */
  --color-event-internal: #9ca3af;   /* gray */
  --color-event-push: #6b7280;       /* dim gray */

  /* Validation colors (Fase 2) */
  --color-validation-pass: #10b981;
  --color-validation-warn: #f59e0b;
  --color-validation-fail: #ef4444;
}

/* Dark theme override */
.dark {
  --color-string: #85e89d;
  --color-number: #ffab70;
  --color-boolean: #b392f0;
  --color-null: #959da5;
  --color-key: #79b8ff;
  --color-bracket: #e1e4e8;
  /* ... etc */
}
```

### 12.3 Auto Theme Detection

```typescript
// Detectar preferencia del sistema
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

// Detectar tema de Chrome DevTools (el panel hereda del DevTools theme)
const devToolsTheme = chrome.devtools?.panels?.themeName; // "dark" | "default"
```

Prioridad de theme: `UserSettings.theme` > `devtools.panels.themeName` > `prefers-color-scheme`.

---

## 13. Build y Bundling

### 13.1 Vite + CRXJS

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import crx from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  build: {
    target: "esnext",
    minify: "esbuild",
    rollupOptions: {
      output: {
        // Chunks separados para cada entry point
        manualChunks: undefined,
      },
    },
  },
});
```

### 13.2 Entry Points

CRXJS genera automáticamente los entry points desde el manifest:

| Entry        | Source                          | Output                |
| ------------ | ------------------------------- | --------------------- |
| Background   | `src/background/index.ts`       | `service-worker.js`   |
| Content      | `src/content/index.ts`          | `content-script.js`   |
| DevTools     | `src/devtools/devtools.html`    | `devtools.html`       |
| Panel        | `src/devtools/panel.html`       | `panel.html` + chunks |
| Popup        | `src/popup/popup.html`          | `popup.html` + chunks |
| Page Script  | `src/page/index.ts`             | `page-script.js`      |

### 13.3 Page Script como Web Accessible Resource

El page script necesita ser accesible desde la página para inyección via `<script src>`:

```json
{
  "web_accessible_resources": [
    {
      "resources": ["src/page/index.ts"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 13.4 Tamaño Target

| Componente    | Budget   |
| ------------- | -------- |
| Page script   | < 5KB    |
| Content script| < 3KB    |
| Service worker| < 10KB   |
| Panel (React) | < 150KB  |
| Popup (React) | < 30KB   |
| Assets/icons  | < 10KB   |
| **Total**     | **< 200KB** |

Shared chunks de React/Zustand cuentan para panel y popup (no se cargan ambos a la vez).

---

## 14. Rendimiento

### 14.1 Métricas Target

| Métrica                                | Target        |
| -------------------------------------- | ------------- |
| Overhead en la página (page script)    | < 1ms por push |
| Latencia push → visible en panel       | < 50ms        |
| Render de 500 eventos en timeline      | < 100ms       |
| Memory del SW con 500 eventos          | < 5MB         |
| Startup del panel                      | < 200ms       |
| Search en 500 eventos                  | < 10ms        |

### 14.2 Estrategias de Optimización

#### Page Script
- Código minimal, sin imports pesados. Solo lo necesario para interceptar push.
- `Date.now()` en lugar de `performance.now()` (no necesitamos sub-ms precision)
- `crypto.randomUUID()` (nativo, rápido) para IDs

#### Event List (virtualización)
- Solo renderizar eventos visibles en el viewport
- Altura fija por item (para cálculo de posición sin medición)
- Overscan de 5 items arriba/abajo

#### JSON Tree (lazy rendering)
- Solo renderizar nodos expandidos
- Nodos colapsados muestran preview (first key/value o type+count)
- No renderizar más de 100 keys al mismo nivel sin paginación ("Show more...")

#### Service Worker
- Eventos en array plano (no indexados) — para 500 items, linear scan es suficiente
- Debounce de storage.session writes (500ms)
- Broadcast solo a ports del tab afectado, no a todos

---

## 15. Testing Strategy

### 15.1 Unit Tests (Vitest)

| Módulo                | Qué testear                                                 |
| --------------------- | ----------------------------------------------------------- |
| `src/page/`           | Interceptación de push, detección de containers, handling de arrays existentes |
| `src/shared/types.ts` | Type guards, serialización/deserialización                  |
| `src/shared/messages.ts` | Creación y validación de messages                        |
| `src/background/`     | TabState management, event processing pipeline, port routing |
| Schema engine (F2)    | Pattern matching, field validation, nested paths, array notation |
| Diff engine (F2)      | Deep object diff, added/removed/modified detection          |
| Code generator (F2)   | Playwright output, Cypress output, assertion styles         |

**Convención**: Archivos de test junto al source: `foo.ts` → `foo.test.ts`.

### 15.2 Integration Tests

Usar Playwright con un Chrome profile que tenga la extensión cargada:

```
1. Navegar a una página con GTM
2. Hacer push al dataLayer desde la consola
3. Verificar que el evento aparece en el DevTools panel
4. Verificar filtros, búsqueda, copy
```

### 15.3 Coverage Target

- Unit tests: > 80% en módulos de lógica (page, background, shared, engines)
- UI: No se mide coverage. Se testean interacciones clave con integration tests.

---

## 16. Seguridad

### 16.1 Principio de Mínimo Privilegio

- No pedir permisos que no se usan en el MVP
- `tabs` es optional (se pide solo si se necesita `onRemoved`)
- `host_permissions: <all_urls>` es necesario para content scripts, pero se documenta en la store

### 16.2 Sanitización

- **Datos del dataLayer son untrusted**. La página puede poner cualquier cosa en el dataLayer.
- NO usar `innerHTML` para renderizar datos del dataLayer. Solo `textContent` o React JSX (que escapa por defecto).
- NO ejecutar código del dataLayer (ej: no usar `eval()` en fields del dataLayer).
- JSON tree view: los valores se renderizan como texto, nunca como HTML.

### 16.3 Message Validation

- Content script valida `source === MESSAGE_SOURCE` antes de procesar
- Service worker valida `sender.tab?.id` existe antes de procesar
- DevTools panel valida tipos de mensaje antes de actualizar state

### 16.4 CSP

MV3 enforce una CSP estricta por defecto:
- No inline scripts
- No `eval()`
- No `unsafe-inline`
- El page script es un archivo separado cargado via `<script src>`, no inline

---

## 17. Estructura de Directorios Final

```
strata/
├── docs/
│   ├── RESEARCH.md
│   ├── PLAN.md
│   └── SPEC.md                  # este archivo
├── src/
│   ├── assets/
│   │   └── icons/
│   │       ├── icon-16.png
│   │       ├── icon-32.png
│   │       ├── icon-48.png
│   │       └── icon-128.png
│   ├── background/
│   │   ├── index.ts              # Service worker entry
│   │   ├── tab-manager.ts        # TabState CRUD
│   │   ├── port-manager.ts       # Connected ports management
│   │   └── storage.ts            # Persistence to chrome.storage.session
│   ├── content/
│   │   └── index.ts              # Content script (relay)
│   ├── devtools/
│   │   ├── devtools.html         # DevTools page (registers panel)
│   │   ├── devtools.ts           # Panel registration
│   │   ├── panel.html            # Panel HTML shell
│   │   └── panel/
│   │       ├── main.tsx          # React entry point
│   │       ├── App.tsx           # Root component
│   │       ├── store.ts          # Zustand store
│   │       ├── hooks/
│   │       │   ├── use-connection.ts   # Port connection to SW
│   │       │   ├── use-events.ts       # Event selectors
│   │       │   └── use-search.ts       # Search logic
│   │       ├── components/
│   │       │   ├── Toolbar.tsx
│   │       │   ├── EventList.tsx
│   │       │   ├── EventItem.tsx
│   │       │   ├── DetailView.tsx
│   │       │   ├── JsonTreeView.tsx
│   │       │   ├── JsonRawView.tsx
│   │       │   ├── SearchBar.tsx
│   │       │   ├── FilterDropdown.tsx
│   │       │   └── SettingsDialog.tsx
│   │       └── lib/
│   │           ├── json-tree.ts        # Tree rendering logic
│   │           └── search.ts           # Search/filter engine
│   ├── page/
│   │   └── index.ts              # Injected page script
│   ├── popup/
│   │   ├── popup.html
│   │   ├── main.tsx
│   │   └── App.tsx
│   └── shared/
│       ├── types.ts              # All shared types
│       ├── messages.ts           # Message type definitions & creators
│       └── constants.ts          # MESSAGE_SOURCE, port names, defaults
├── manifest.json                 # Chrome MV3 manifest (CRXJS source)
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── package.json
├── .eslintrc.cjs
├── .prettierrc
├── LICENSE
└── README.md
```

---

## 18. Dependencias

### 18.1 Runtime

| Paquete                        | Uso                              | Tamaño aprox |
| ------------------------------ | -------------------------------- | ------------ |
| `react`                        | UI framework                     | ~6KB gzip    |
| `react-dom`                    | React renderer                   | ~40KB gzip   |
| `zustand`                      | State management                 | ~1KB gzip    |
| `react-window`                 | Virtualización de listas         | ~6KB gzip    |
| **Total runtime**              |                                  | ~53KB gzip   |

> **`google/data-layer-helper` se descarta como dependencia runtime.** No se importa directamente. El page script implementa la interceptación con un approach más ligero (monkey-patch del push). El helper es útil si se necesita el abstract data model (merge de estado) que se considerará para snapshots en Fase 2.

### 18.2 Dev Dependencies

| Paquete                        | Uso                              |
| ------------------------------ | -------------------------------- |
| `vite`                         | Build tool                       |
| `@crxjs/vite-plugin`          | Chrome extension scaffolding     |
| `@vitejs/plugin-react`        | React Fast Refresh + JSX         |
| `typescript`                   | Compilador                       |
| `tailwindcss`                  | CSS framework                    |
| `vitest`                       | Unit tests                       |
| `@playwright/test`            | E2E tests                        |
| `eslint`                       | Linting                          |
| `prettier`                     | Formatting                       |

---

## 19. Fase 2 — Specs Adicionales

### 19.1 Schema Validation Engine

```
Input: DataLayerEvent + SchemaRule[]
Output: ValidationResult[]

Algoritmo:
1. Para cada SchemaRule habilitada:
   a. Si eventPattern empieza con "/", es regex → test contra eventName
   b. Si no, comparar como string exacto contra eventName
   c. Si no matchea → skip
   d. Si matchea:
      i.  Para cada campo en required[]:
          - Resolver path en dot notation contra event.data
          - Si path incluye "[]": iterar sobre cada elemento del array
          - Verificar existencia → error si falta
          - Verificar tipo → error si no coincide
      ii. Para cada campo en optional[]:
          - Misma resolución
          - Si falta → warning (no error)
      iii. Construir ValidationResult

Path resolution:
- "ecommerce.value" → data.ecommerce.value
- "ecommerce.items[].item_id" → para cada data.ecommerce.items[i], verificar item_id
- Soportar hasta 3 niveles de nesting de arrays
```

### 19.2 Diff Engine

```
Input: stateA: Record<string, unknown>, stateB: Record<string, unknown>
Output: DiffEntry[]

Algoritmo (recursive deep diff):
1. Obtener union de keys de ambos objetos
2. Para cada key:
   a. Si key solo en A → DiffEntry { type: "removed", oldValue }
   b. Si key solo en B → DiffEntry { type: "added", newValue }
   c. Si en ambos:
      i.  Si ambos son objetos → recurse
      ii. Si ambos son arrays → comparar por index (no por contenido)
      iii.Si valores distintos (===) → DiffEntry { type: "modified", oldValue, newValue }
3. Return flat array con paths en dot notation
```

### 19.3 Test Code Generator

```
Input: DataLayerEvent[], ExportTestOptions
Output: string (código generado)

Templates:
- playwright-exact: assertions con valores literales
- playwright-type: assertions con expect.any(Type)
- cypress-exact: assertions con valores literales
- cypress-type: assertions con type checks

El código generado incluye:
1. Imports del framework
2. Test describe/it blocks
3. page.goto() si includeNavigation
4. Evaluación de window.dataLayer
5. Para cada evento:
   a. Find event by eventName (o por index si no tiene eventName)
   b. Assert existence
   c. Para cada key en el evento:
      - exact: expect(value).toBe(actualValue)
      - type-only: expect(value).toEqual(expect.any(Type))
6. Solo genera assertions para las top-level keys y un nivel de nesting
   (no genera assertions para CADA campo nested recursivamente)
```

---

## 20. Posibles Riesgos Técnicos

| Riesgo                                          | Mitigación                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| CRXJS no soporta React 19 estable               | Verificar compatibilidad. Fallback: configuración manual de Vite |
| Service Worker se suspende y pierde eventos      | Persistencia en storage.session + reconexión automática de ports |
| Page script inyectado DESPUÉS de pushes iniciales| Procesar array existente al inyectar                             |
| CSP de la página bloquea inyección de script     | Usar `chrome.scripting.executeScript` como fallback              |
| dataLayer no es un Array estándar (Tealium, etc.)| Fase 1 soporta solo arrays. Fase 3 podría extender.             |
| Conflicto con otras extensiones similares        | `MESSAGE_SOURCE` unique, no modificar window.dataLayer           |
| Chrome update cambia API de DevTools              | Pinear versión mínima de Chrome en manifest (minimumChromeVersion) |

---

## Apéndice A — Referencia de Eventos GTM Comunes

Para implementar color-coding y presets de schema validation:

| Event Name              | Categoría    | Descripción                           |
| ----------------------- | ------------ | ------------------------------------- |
| `gtm.js`               | GTM internal | GTM container loaded                  |
| `gtm.dom`              | GTM internal | DOM ready                             |
| `gtm.load`             | GTM internal | Window loaded                         |
| `page_view`            | GA4          | Page view                             |
| `view_item`            | Ecommerce    | Product page view                     |
| `view_item_list`       | Ecommerce    | Product list view                     |
| `add_to_cart`          | Ecommerce    | Add item to cart                      |
| `remove_from_cart`     | Ecommerce    | Remove item from cart                 |
| `begin_checkout`       | Ecommerce    | Start checkout                        |
| `add_payment_info`     | Ecommerce    | Payment info added                    |
| `add_shipping_info`    | Ecommerce    | Shipping info added                   |
| `purchase`             | Ecommerce    | Purchase completed                    |
| `refund`               | Ecommerce    | Refund processed                      |
| `view_promotion`       | Ecommerce    | Promotion viewed                      |
| `select_promotion`     | Ecommerce    | Promotion clicked                     |
| `login`                | Engagement   | User login                            |
| `sign_up`              | Engagement   | User registration                     |
| `search`               | Engagement   | Site search                           |
| `share`                | Engagement   | Content shared                        |
| `generate_lead`        | Conversion   | Lead form submission                  |

---

## Apéndice B — Ejemplo de Schema Preset GA4 Purchase

```json
{
  "id": "ga4-purchase",
  "name": "GA4 Purchase Event",
  "eventPattern": "purchase",
  "required": [
    { "path": "ecommerce.transaction_id", "type": "string", "description": "Unique transaction ID" },
    { "path": "ecommerce.value", "type": "number", "description": "Total value of the transaction" },
    { "path": "ecommerce.currency", "type": "string", "description": "Currency code (ISO 4217)" },
    { "path": "ecommerce.items", "type": "array", "description": "Array of purchased items" },
    { "path": "ecommerce.items[].item_id", "type": "string", "description": "Product ID/SKU" },
    { "path": "ecommerce.items[].item_name", "type": "string", "description": "Product name" }
  ],
  "optional": [
    { "path": "ecommerce.tax", "type": "number", "description": "Tax amount" },
    { "path": "ecommerce.shipping", "type": "number", "description": "Shipping cost" },
    { "path": "ecommerce.coupon", "type": "string", "description": "Coupon code" },
    { "path": "ecommerce.items[].price", "type": "number", "description": "Item price" },
    { "path": "ecommerce.items[].quantity", "type": "number", "description": "Quantity purchased" },
    { "path": "ecommerce.items[].item_brand", "type": "string", "description": "Product brand" },
    { "path": "ecommerce.items[].item_category", "type": "string", "description": "Product category" }
  ],
  "enabled": true
}
```
