# Strata — Plan de Desarrollo

> Basado en [RESEARCH.md](./RESEARCH.md) — Marzo 2026

## Visión

**"Strata"** — Una extensión de Chrome MV3-native para inspeccionar, validar y exportar el `dataLayer` de Google Tag Manager y otros TMS. Orientada a desarrolladores y analistas técnicos.

## Alcance del Plan

- **Fase 1 (MVP)**: Completa — Monitoreo real-time, UI moderna, DevTools panel
- **Fase 2 (Diferenciación)**: Schema validation, diff view, export test assertions, export JSON

---

## Arquitectura

### Componentes de la Extensión

```
┌─────────────────────────────────────────────────────┐
│                   Chrome Browser                     │
│                                                      │
│  ┌──────────────┐    ┌───────────────────────────┐   │
│  │  Popup        │    │   DevTools Panel (React)  │   │
│  │  (quick view) │    │   ├── Event Timeline      │   │
│  │              │    │   ├── JSON Tree View       │   │
│  └──────┬───────┘    │   ├── Search/Filter        │   │
│         │            │   ├── Schema Validator [F2] │   │
│         │            │   ├── Diff View [F2]        │   │
│         │            │   └── Export Panel [F2]     │   │
│         │            └───────────┬─────────────────┘   │
│         │                        │                     │
│         ▼                        ▼                     │
│  ┌─────────────────────────────────────────────┐      │
│  │         Service Worker (background)          │      │
│  │  ├── Message router                          │      │
│  │  ├── Tab state management                    │      │
│  │  └── Storage coordination                    │      │
│  └──────────────────┬──────────────────────────┘      │
│                     │                                  │
│                     ▼                                  │
│  ┌─────────────────────────────────────────────┐      │
│  │         Content Script (per tab)             │      │
│  │  ├── Injects page script                     │      │
│  │  └── Relays messages (page ↔ extension)      │      │
│  └──────────────────┬──────────────────────────┘      │
│                     │                                  │
│                     ▼                                  │
│  ┌─────────────────────────────────────────────┐      │
│  │         Page Script (injected)               │      │
│  │  ├── DataLayerHelper listener                │      │
│  │  ├── Intercepts dataLayer.push()             │      │
│  │  ├── Captures URL + timestamp                │      │
│  │  └── Detects multiple containers             │      │
│  └─────────────────────────────────────────────┘      │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### Flujo de Datos

```
dataLayer.push({event: "purchase"})
    │
    ▼
[Page Script] — captura push con timestamp + URL + container ID
    │
    ▼ window.postMessage()
[Content Script] — filtra y retransmite
    │
    ▼ chrome.runtime.sendMessage()
[Service Worker] — almacena en memoria por tab, notifica listeners
    │
    ├──▶ [DevTools Panel] — renderiza evento en timeline
    └──▶ [Popup] — actualiza contador / vista rápida
```

### Stack Técnico

| Aspecto           | Decisión                   | Razón                                                      |
| ----------------- | -------------------------- | ---------------------------------------------------------- |
| **Language**      | TypeScript (strict)        | Type safety, mejor DX                                      |
| **UI Framework**  | React 19                   | Ecosistema probado para extensiones (dataslayer lo valida) |
| **Build**         | Vite + CRXJS               | Build rápido, HMR, manejo automático de manifest           |
| **Styling**       | Tailwind CSS 4             | Utilidades, tema oscuro/claro, tamaño mínimo con purge     |
| **State**         | Zustand                    | Ligero, sin boilerplate, persistencia fácil                |

| **Manifest**      | V3 nativo                  | Service worker, sin background page                        |
| **Testing**       | Vitest + Playwright        | Unit + E2E para la extensión                               |
| **Tamaño target** | < 200KB                    | Más ligera que la mayoría de competidores                  |

---

## Fase 1 — MVP

> Objetivo: Extensión funcional que monitorea el dataLayer en real-time con UI moderna desde DevTools.

### 1.1 — Scaffold del Proyecto

**Entregable**: Proyecto base con build funcional.

- [ ] Inicializar repo: `package.json`, TypeScript config, ESLint, Prettier
- [ ] Configurar Vite con plugin CRXJS para Chrome Extensions MV3
- [ ] Crear `manifest.json` (MV3): permissions mínimos (`activeTab`, `scripting`, `storage`) + `web_accessible_resources` para el page script
- [ ] Estructura de directorios:
  ```
  src/
  ├── background/        # Service worker
  │   └── index.ts
  ├── content/           # Content script
  │   └── index.ts
  ├── page/              # Script inyectado en la página
  │   └── index.ts
  ├── devtools/          # DevTools page + panel
  │   ├── devtools.html
  │   ├── devtools.ts
  │   ├── panel.html
  │   └── panel/
  │       ├── App.tsx
  │       └── main.tsx
  ├── popup/             # Popup quick-view
  │   ├── popup.html
  │   ├── App.tsx
  │   └── main.tsx
  ├── shared/            # Tipos, utilidades, constantes compartidas
  │   ├── types.ts
  │   ├── messages.ts
  │   └── constants.ts
  └── assets/            # Iconos, estilos base
  ```
- [ ] Verificar que build genera extensión instalable en Chrome
- [ ] Configurar Tailwind CSS 4
- [ ] Agregar React 19 + Zustand

### 1.2 — Captura del DataLayer (Page Script + Content Script)

**Entregable**: Captura de todos los `dataLayer.push()` con metadata precisa.

- [ ] **Page Script** (`src/page/index.ts`):
  - Detectar existencia de `window.dataLayer` (o esperar a que se cree)
  - Interceptar `.push()` con monkey-patch de `Array.prototype.push`
  - Capturar por cada push: `{ event, data, timestamp, url, containerIds[] }`
  - Detectar múltiples dataLayer arrays (ej: `dataLayer`, `dataLayer2`, custom names)
  - Enviar eventos via `window.postMessage()` con source identifier
- [ ] **Content Script** (`src/content/index.ts`):
  - Inyectar page script en el contexto de la página via `<script src>` (requiere `web_accessible_resources` en manifest)
  - Escuchar `window.postMessage` del page script
  - Filtrar solo mensajes con nuestro source identifier
  - Reenviar a service worker via `chrome.runtime.sendMessage()`
- [ ] **Tipos compartidos** (`src/shared/types.ts`):
  ```typescript
  interface DataLayerEvent {
  	id: string; // UUID único
  	timestamp: number; // Date.now()
  	url: string; // location.href al momento del push
  	event?: string; // nombre del evento (si tiene key "event")
  	data: Record<string, unknown>; // payload completo del push
  	containerIds: string[]; // GTM container IDs detectados
  	source: string; // nombre del dataLayer array ("dataLayer", custom)
  }
  ```

### 1.3 — Service Worker (Background)

**Entregable**: Gestión centralizada de estado por tab.

- [ ] Recibir eventos desde content scripts
- [ ] Mantener estado en memoria por `tabId`:
  ```typescript
  interface TabState {
  	tabId: number;
  	events: DataLayerEvent[];
  	containers: string[]; // GTM IDs detectados
  	url: string; // URL actual
  	isRecording: boolean;
  }
  ```
- [ ] Limpiar estado cuando tab se cierra (`chrome.tabs.onRemoved`)
- [ ] Actualizar URL cuando tab navega (`chrome.webNavigation.onCommitted`)
- [ ] Exponer API para que DevTools panel y popup consulten estado:
  - `getEvents(tabId)` → lista de eventos
  - `clearEvents(tabId)` → limpiar timeline
  - `getContainers(tabId)` → containers detectados
- [ ] Broadcast de nuevos eventos a todos los listeners conectados (DevTools panels abiertos)

### 1.4 — DevTools Panel

**Entregable**: Panel en DevTools con timeline de eventos y JSON tree view.

- [ ] **DevTools Page** (`src/devtools/devtools.ts`):
  - Registrar panel: `chrome.devtools.panels.create("DataLayer", ...)` (nombre corto para mejor UX en la barra)
- [ ] **Panel App** (`src/devtools/panel/App.tsx`):
  - Layout: toolbar arriba, event list a la izquierda, detail view a la derecha
  - Conectar al service worker al montar, solicitar eventos del tab inspeccionado
  - Suscribirse a nuevos eventos en real-time
- [ ] **Event Timeline** (lista lateral):
  - Cada evento muestra: timestamp (HH:MM:SS.ms), event name (o "push"), badge con source
  - Color-coding por tipo: `event` (azul), `ecommerce` (verde), `pageview` (gris), `error` (rojo)
  - Auto-scroll al último evento (toggle on/off)
  - Indicador visual cuando llega un nuevo evento
- [ ] **Detail View** (panel principal):
  - **JSON Tree View**: expandible/colapsible, con syntax highlighting por tipo de dato
    - strings: verde, numbers: naranja, booleans: morado, null/undefined: gris, arrays: badges con length
  - **Raw JSON View**: texto formateado con copy button
  - Toggle entre Tree y Raw
  - Breadcrumb de navegación para objetos anidados
- [ ] **Toolbar**:
  - Botón "Clear" para limpiar timeline
  - Toggle "Record" para pausar/resumir captura
  - Contador de eventos
  - Indicador de containers detectados (badges)

### 1.5 — Search y Filter

**Entregable**: Búsqueda y filtrado de eventos en el timeline.

- [ ] **Search bar** en el toolbar:
  - Búsqueda por texto libre en event name, keys, y values
  - Debounced (300ms)
  - Highlight de matches en el tree view
- [ ] **Filtros rápidos**:
  - Por event name (dropdown con todos los event names capturados)
  - Por source/container (cuando hay múltiples)
  - Por rango de tiempo (desde-hasta)
- [ ] **Keyboard shortcuts**:
  - `Cmd+F` / `Ctrl+F`: focus en search
  - `Escape`: limpiar búsqueda
  - `↑` / `↓`: navegar entre eventos
  - `Enter`: expandir/colapsar evento seleccionado

### 1.6 — Multi-Container Support

**Entregable**: Soporte correcto para múltiples containers GTM y dataLayers custom.

- [ ] Detectar múltiples GTM containers (buscar `google_tag_manager` en window)
- [ ] Detectar dataLayer arrays con nombres custom (configurable por el usuario)
- [ ] Mostrar badge/tag por container en cada evento
- [ ] Filtro rápido por container
- [ ] Settings: input para agregar nombres de dataLayer arrays custom a monitorear

### 1.7 — Copy y Export

**Entregable**: Copiar eventos individuales o el timeline completo.

- [ ] **Copy individual event**: botón en detail view → copia JSON al clipboard
- [ ] **Copy all events**: botón en toolbar → copia array de todos los eventos (filtrados)
- [ ] Notificación visual de "Copied!" (toast)
- [ ] Formato de export limpio (sin metadata interna, solo data útil)

### 1.8 — Popup (Quick View)

**Entregable**: Vista rápida del estado del dataLayer sin abrir DevTools.

- [ ] Mostrar último evento capturado
- [ ] Contador de eventos totales
- [ ] Lista de containers detectados
- [ ] Botón para abrir DevTools panel directamente
- [ ] Estado: "No dataLayer detected" cuando no hay data
- [ ] Mismo theme (dark/light) que el panel

### 1.9 — Settings y Preferences

**Entregable**: Configuración persistente.

- [ ] **Opciones almacenadas** (`chrome.storage.sync`):
  - Theme: auto / dark / light
  - Custom dataLayer names a monitorear (default: `["dataLayer"]`)
  - Auto-scroll on/off (default: on)
  - Max events to keep per tab (default: 500)
  - JSON tree default expand depth (default: 2)
- [ ] Accesible desde:
  - Gear icon en DevTools panel toolbar
  - Popup footer link
- [ ] Cambios se aplican inmediatamente (sin refresh)

### 1.10 — Testing y QA de Fase 1

**Entregable**: Extensión estable y testeada.

- [ ] **Unit tests** (Vitest):
  - Page script: interceptación de push, detección de containers
  - Service worker: gestión de tab state, message routing
  - Shared: tipos, utilidades, formateo de data
- [ ] **Integration tests**:
  - Flujo completo: push en página → aparece en DevTools panel
  - Multi-container detection
  - Navegación entre páginas mantiene/limpia estado correcto
- [ ] **Manual QA checklist**:
  - [ ] Funciona en sitio con GTM estándar
  - [ ] Funciona en sitio sin GTM (muestra "no dataLayer")
  - [ ] Funciona con dataLayer ya poblado antes de instalar extensión
  - [ ] Funciona con SPA (React Router, Next.js)
  - [ ] Funciona con múltiples GTM containers
  - [ ] Funciona con ad blockers habilitados (uBlock Origin, Brave Shields)
  - [ ] No interfiere con el funcionamiento normal de la página
  - [ ] Performance: no lag visible con 500+ eventos
  - [ ] Tamaño del bundle < 200KB

---

## Fase 2 — Diferenciación

> Objetivo: Features que ningún competidor ofrece. La extensión pasa de "viewer" a "QA tool".

### 2.1 — Export JSON

**Entregable**: Exportar eventos capturados como archivo JSON.

- [ ] Botón "Export JSON" en toolbar del DevTools panel
- [ ] Opciones de export:
  - Todos los eventos vs solo los filtrados
  - Formato: "raw" (tal como se capturó) vs "clean" (sin metadata interna)
  - Incluir/excluir timestamp y URL
- [ ] Genera archivo `.json` descargable con nombre: `datalayer-{domain}-{timestamp}.json`
- [ ] Formato del archivo:
  ```json
  {
    "exportedAt": "2026-03-15T10:30:00Z",
    "url": "https://example.com",
    "containers": ["GTM-XXXXX"],
    "totalEvents": 42,
    "events": [
      {
        "timestamp": "2026-03-15T10:29:01.123Z",
        "url": "https://example.com/page",
        "event": "page_view",
        "data": { ... }
      }
    ]
  }
  ```
- [ ] Keyboard shortcut: `Cmd+Shift+E` / `Ctrl+Shift+E`

### 2.2 — Schema Validation

**Entregable**: Validar eventos del dataLayer contra esquemas definidos por el usuario.

> **Killer feature** — Ningún competidor lo tiene. Transforma la extensión de "viewer" a "QA tool".

- [ ] **Schema definition UI**:
  - Crear schemas desde el panel de Settings
  - Cada schema tiene: nombre, event name pattern (regex), campos requeridos, tipos esperados
  - Ejemplo: schema "Purchase" → event: `purchase`, requiere `ecommerce.items[]`, cada item requiere `item_id`, `item_name`, `price`
- [ ] **Schema format** (JSON almacenado en `chrome.storage.local`):

  ```typescript
  interface SchemaRule {
  	id: string;
  	name: string;
  	eventPattern: string; // regex o string exacto
  	required: SchemaField[]; // campos requeridos
  	optional?: SchemaField[]; // campos opcionales documentados
  	enabled: boolean;
  }

  interface SchemaField {
  	path: string; // dot notation: "ecommerce.items[].item_id"
  	type: "string" | "number" | "boolean" | "array" | "object";
  	description?: string;
  }
  ```

- [ ] **Validación en real-time**:
  - Cada evento se valida contra todos los schemas habilitados cuyo `eventPattern` haga match
  - Resultado por evento: ✅ pass, ⚠️ warnings (campos opcionales faltantes), ❌ fail (campos requeridos faltantes o tipo incorrecto)
  - Badge de status en el timeline (icono de check/warning/x)
- [ ] **Validation detail view**:
  - Al seleccionar un evento fallido, mostrar lista de errores/warnings
  - Cada error indica: campo faltante o tipo incorrecto, valor esperado vs recibido
  - Link rápido al campo en el JSON tree view
- [ ] **Schemas presets** (built-in):
  - GA4 Recommended Events (page_view, purchase, add_to_cart, begin_checkout, etc.)
  - Importar/exportar schemas como JSON
- [ ] **Import/Export schemas**:
  - Exportar todos los schemas como archivo `.json` (para compartir con equipo)
  - Importar schemas desde archivo `.json`
- [ ] **Dashboard de validación**:
  - Summary: X eventos validados, Y pasaron, Z fallaron
  - Filtro rápido: "Show only failed"

### 2.3 — Diff View

**Entregable**: Comparar snapshots del dataLayer estado lado a lado.

- [ ] **Snapshot capture**:
  - Botón "Take Snapshot" en toolbar
  - Captura el estado actual del abstract data model (merge de todos los pushes)
  - Considerar `google/data-layer-helper` para computar el estado acumulado (no se usa en Fase 1)
  - Almacena con label editable y timestamp
  - Máximo 20 snapshots por sesión
- [ ] **Snapshot list**:
  - Panel secundario listando snapshots guardados
  - Cada snapshot muestra: label, timestamp, URL, # de keys
  - Acciones: rename, delete, select for compare
- [ ] **Diff view**:
  - Seleccionar 2 snapshots para comparar
  - Vista side-by-side con highlighting:
    - 🟢 Verde: keys/values agregados
    - 🔴 Rojo: keys/values removidos
    - 🟡 Amarillo: values modificados
  - Expand/collapse por sección
  - Solo mostrar diferencias (con toggle para ver todo)
- [ ] **Quick diff**:
  - Comparar "estado al evento N" vs "estado al evento M"
  - Seleccionar dos eventos en el timeline y click "Compare states"

### 2.4 — Export como Test Assertions

**Entregable**: Generar código de test E2E desde eventos capturados.

- [ ] **Selector de eventos**:
  - Checkbox en cada evento del timeline para seleccionar cuáles exportar
  - "Select All" / "Select filtered"
- [ ] **Generador de código**:
  - **Playwright (TypeScript)**:

    ```typescript
    // Generated by Strata
    import { test, expect } from "@playwright/test";

    test("dataLayer events on /checkout", async ({ page }) => {
    	await page.goto("https://example.com/checkout");

    	const dataLayer = await page.evaluate(() => window.dataLayer);

    	// Assert: purchase event
    	const purchaseEvent = dataLayer.find((e) => e.event === "purchase");
    	expect(purchaseEvent).toBeDefined();
    	expect(purchaseEvent.ecommerce.transaction_id).toBeDefined();
    	expect(purchaseEvent.ecommerce.items).toHaveLength(2);
    	expect(purchaseEvent.ecommerce.items[0]).toMatchObject({
    		item_id: expect.any(String),
    		item_name: expect.any(String),
    		price: expect.any(Number),
    	});
    });
    ```

  - **Cypress (JavaScript)**:

    ```javascript
    // Generated by Strata
    describe("dataLayer events on /checkout", () => {
    	it("should fire purchase event", () => {
    		cy.visit("https://example.com/checkout");

    		cy.window().then((win) => {
    			const purchaseEvent = win.dataLayer.find(
    				(e) => e.event === "purchase",
    			);
    			expect(purchaseEvent).to.exist;
    			expect(purchaseEvent.ecommerce.transaction_id).to.be.a("string");
    			expect(purchaseEvent.ecommerce.items).to.have.length(2);
    		});
    	});
    });
    ```

- [ ] **Opciones de export**:
  - Framework: Playwright (TS) / Cypress (JS)
  - Assertion style: exact values vs type-only (`expect.any(String)`)
  - Incluir URL navigation (`page.goto(...)`)
  - Incluir waits/timeouts para SPAs
- [ ] **Copy to clipboard** o **Download as file**
- [ ] Keyboard shortcut: `Cmd+Shift+T` / `Ctrl+Shift+T`

### 2.5 — Export Evidence Image

**Entregable**: Generar imágenes/PDFs profesionales de eventos capturados para enviar como evidencia a equipos de Analytics.

> **Pain point real** — Actualmente QA hace screenshots manuales del DevTools que se ven feos y son difíciles de leer. Esta feature permite generar evidencias visuales limpias y profesionales.

- [ ] **Selección de eventos**:
  - Mostrar todos los eventos capturados
  - Permitir elegir cuáles se muestran expandidos vs colapsados
  - Los expandidos muestran todo el JSON tree con syntax highlighting
  - Los colapsados muestran solo: timestamp + event name + badge
- [ ] **Metadata del reporte**:
  - Campo editable: "Escenario / Flujo" (ej: "Checkout flow - Purchase completo")
  - Timestamp de generación
  - URL del sitio
  - Containers GTM detectados
- [ ] **Diseño visual**:
  - Layout limpio y profesional (no parece un screenshot de DevTools)
  - Syntax highlighting para JSON (mismo esquema de colores que el panel)
  - Branding de Strata: logo en header/footer
  - Optimizado para ser legible por personas no-técnicas
  - Responsive: se ajusta al contenido (no corta datos)
- [ ] **Formatos de export**:
  - **PNG**: Imagen única, ideal para Slack/Teams/emails
  - **PDF**: Documento multipágina si hay muchos eventos, ideal para documentación formal
- [ ] **Preview antes de exportar**:
  - Modal con preview de cómo quedará la imagen/PDF
  - Ajustar selección de expandidos/colapsados en el preview
- [ ] **Generación**:
  - Usar `html2canvas` o similar para PNG
  - Usar `jsPDF` o similar para PDF
  - Nombre del archivo: `strata-evidence-{scenario-slug}-{timestamp}.{png|pdf}`

### 2.6 — Testing y QA de Fase 2

- [ ] **Unit tests**:
  - Schema validation engine: match de patterns, validación de tipos, nested paths
  - Diff algorithm: detect adds, removes, changes en objetos anidados
  - Code generator: output correcto para Playwright y Cypress
- [ ] **Integration tests**:
  - Schema cargado → evento llega → validación se muestra correctamente
  - Snapshot → snapshot → diff muestra cambios correctos
  - Export genera código que compila sin errores
- [ ] **Manual QA checklist**:
  - [ ] Schema validation funciona con GA4 presets en sitio real
  - [ ] Diff detecta correctamente cambios en objetos deeply nested
  - [ ] Export Playwright genera test que pasa en un proyecto real
  - [ ] Export Cypress genera test que pasa en un proyecto real
  - [ ] Import/export de schemas funciona correctamente
  - [ ] Export Evidence genera PNG/PDF legible con todos los datos
  - [ ] Performance con 20 snapshots + 500 eventos sigue fluida

---

## Milestone Summary

| Milestone                 | Entregable                                    | Dependencias |
| ------------------------- | --------------------------------------------- | ------------ |
| **1.1** Scaffold          | Build funcional, instalable en Chrome         | —            |
| **1.2** Captura           | dataLayer.push() interceptado, eventos fluyen | 1.1          |
| **1.3** Service Worker    | Estado por tab, message routing               | 1.2          |
| **1.4** DevTools Panel    | Timeline + JSON tree view                     | 1.3          |
| **1.5** Search/Filter     | Búsqueda y filtros en timeline                | 1.4          |
| **1.6** Multi-Container   | Múltiples GTM containers + custom DL          | 1.2          |
| **1.7** Copy/Export       | Copiar eventos al clipboard                   | 1.4          |
| **1.8** Popup             | Vista rápida sin DevTools                     | 1.3          |
| **1.9** Settings          | Configuración persistente                     | 1.4          |
| **1.10** QA Fase 1        | Tests + validación manual                     | 1.1–1.9      |
| **2.1** Export JSON       | Descargar archivo JSON                        | 1.7          |
| **2.2** Schema Validation | Validar contra schemas definidos              | 1.4          |
| **2.3** Diff View         | Comparar snapshots side-by-side               | 1.4          |
| **2.4** Export Tests      | Generar Playwright/Cypress assertions         | 1.7, 2.2     |
| **2.5** Export Evidence   | Generar PNG/PDF de evidencia para Analytics   | 1.4          |
| **2.6** QA Fase 2         | Tests + validación manual                     | 2.1–2.5      |

```
Fase 1: 1.1 ──▶ 1.2 ──▶ 1.3 ──▶ 1.4 ──▶ 1.5
                  │              │       ──▶ 1.7
                  ▼              ▼       ──▶ 1.9
                 1.6            1.8
                                         ──▶ 1.10

Fase 2: 1.7 ──▶ 2.1
        1.4 ──▶ 2.2 ──┐
        1.4 ──▶ 2.3   ├──▶ 2.4 ──▶ 2.6
        1.7 ──────────┘
        1.4 ──▶ 2.5 ──────────────┘
```

---

## Fuera de Alcance (Fase 3+)

Los siguientes features están documentados en el research pero NO se implementan en este plan:

- ~~Ecommerce mode~~ (vista especializada para purchase funnels)
- AI-assisted analysis
- Team sharing / reportes compartibles
- CI/CD integration
- Consent/Privacy layer awareness
- Performance impact view
- TypeScript type generation
- Firefox support
- **Role-based views** (Dev/QA/Analytics) — Evaluar post-lanzamiento si hay feedback de usuarios que lo soliciten. Concepto: misma data con layouts optimizados por workflow, posiblemente como "View Mode" toggle en lugar de tabs separados.
