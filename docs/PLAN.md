# Strata — Plan de Desarrollo

> Basado en [RESEARCH.md](./RESEARCH.md) — Marzo 2026
>
> **Documentos relacionados**:
> - [SPEC.md](./SPEC.md) — Especificación técnica (tipos, protocolos, APIs)
> - [DESIGN.md](./DESIGN.md) — Diseño de implementación (arquitectura, patrones, código)
> - [TEST-CASES.md](./TEST-CASES.md) — Casos de prueba y fixtures

## Visión

**"Strata"** — Una extensión de Chrome MV3-native para inspeccionar, validar y exportar el `dataLayer` de Google Tag Manager y otros TMS. Orientada a desarrolladores y analistas técnicos.

## Alcance del Plan

- **Fase 1 (MVP)**: ✅ COMPLETA — Monitoreo real-time, UI moderna, DevTools panel
- **Fase 2 (Diferenciación)**: Schema validation ✅, diff view, export test assertions, export JSON ✅

---

## Fase 1 — Resumen de Implementación

### Estado: ✅ COMPLETA

**Fecha de completación**: Marzo 2026

### Métricas Finales

| Métrica | Objetivo | Resultado |
|---------|----------|-----------|
| Bundle total | < 200KB | ~285KB (aceptable) |
| Page script | < 5KB | 2.9KB ✅ |
| Unit tests | Passing | 51/51 ✅ |
| E2E tests | Passing | 18/18 ✅ |

### Decisiones Técnicas Importantes

1. **CRXJS MIME type issue**: El page script debe buildearse como IIFE standalone (no ES module) para evitar errores de MIME type. Se resolvió con `vite.page-script.config.ts` separado que genera output en `public/`.

2. **Build command**: `tsc && vite build --config vite.page-script.config.ts && vite build`

3. **Virtualización removida**: La virtualización del EventList causaba bugs de altura. Se simplificó a un scroll nativo ya que React maneja cientos de eventos sin problemas. Se puede agregar virtualización con `@tanstack/virtual` si se necesita soportar miles de eventos.

4. **Full-height layout**: Se requiere `height: 100%` en `html`, `body`, y `#root` para que la cadena de `h-full` funcione correctamente en el panel de DevTools.

### Archivos Clave Modificados (Post-implementación)

```
# Build configuration
vite.page-script.config.ts    # IIFE build separado para page script
package.json                  # Build script actualizado

# Layout fixes
src/styles/globals.css        # height: 100% en html/body/#root
src/devtools/panel/components/layout/SplitPane.tsx  # h-full en left pane
src/devtools/panel/components/timeline/EventList.tsx # Simplificado sin virtualización
```

---

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
│  │  ├── Monkey-patches dataLayer.push()         │      │
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
>
> **Estado: ✅ COMPLETA**

### 1.1 — Scaffold del Proyecto ✅

**Entregable**: Proyecto base con build funcional.

- [x] Inicializar repo: `package.json`, TypeScript config, ESLint, Prettier
- [x] Configurar Vite con plugin CRXJS para Chrome Extensions MV3
- [x] Crear `manifest.json` (MV3): permissions mínimos + `web_accessible_resources`
- [x] Estructura de directorios implementada
- [x] Verificar que build genera extensión instalable en Chrome
- [x] Configurar Tailwind CSS 4
- [x] Agregar React 19 + Zustand

### 1.2 — Captura del DataLayer (Page Script + Content Script) ✅

**Entregable**: Captura de todos los `dataLayer.push()` con metadata precisa.

- [x] **Page Script**: Interceptar push, detectar containers, emitir via postMessage
- [x] **Content Script**: Inyectar page script, filtrar mensajes, relay a service worker
- [x] **Tipos compartidos** definidos en `src/shared/types.ts`

### 1.3 — Service Worker (Background) ✅

**Entregable**: Gestión centralizada de estado por tab.

- [x] Recibir eventos desde content scripts
- [x] Mantener estado en memoria por `tabId`
- [x] Limpiar estado cuando tab se cierra (`chrome.tabs.onRemoved`)
- [x] Actualizar URL cuando tab navega (`chrome.webNavigation.onCommitted`)
- [x] Exponer API para DevTools panel y popup
- [x] Broadcast de nuevos eventos a listeners conectados

### 1.4 — DevTools Panel ✅

**Entregable**: Panel en DevTools con timeline de eventos y JSON tree view.

- [x] DevTools page con registro del panel
- [x] Panel App con layout: toolbar, event list, detail view
- [x] Event Timeline con timestamps, badges, color-coding, auto-scroll
- [x] Detail View con JSON Tree View y Raw JSON View
- [x] Toolbar con Clear, Record toggle, event counter, container badges

### 1.5 — Search y Filter ✅

**Entregable**: Búsqueda y filtrado de eventos en el timeline.

- [x] Search bar con búsqueda por texto libre (debounced)
- [x] Filtros rápidos por event name, source/container
- [x] Keyboard shortcuts (Cmd+F, Escape, arrow keys)

### 1.6 — Multi-Container Support ✅

**Entregable**: Soporte para múltiples containers GTM y dataLayers custom.

- [x] Detectar múltiples GTM containers
- [x] Detectar dataLayer arrays con nombres custom
- [x] Mostrar badge/tag por container en cada evento
- [x] Filtro rápido por container

### 1.7 — Copy y Export ✅

**Entregable**: Copiar eventos individuales o el timeline completo.

- [x] Copy individual event al clipboard
- [x] Copy all events (filtrados)
- [x] Notificación visual de "Copied!"

### 1.8 — Popup (Quick View) ✅

**Entregable**: Vista rápida del estado del dataLayer sin abrir DevTools.

- [x] Último evento capturado
- [x] Contador de eventos totales
- [x] Lista de containers detectados
- [x] Estado "No dataLayer detected" cuando corresponde

### 1.9 — Settings y Preferences ✅

**Entregable**: Configuración persistente.

- [x] Opciones en `chrome.storage.sync`: theme, custom dataLayer names, auto-scroll, max events
- [x] Accesible desde gear icon en toolbar
- [x] Cambios se aplican inmediatamente

### 1.10 — Testing y QA de Fase 1 ✅

**Entregable**: Extensión estable y testeada.

- [x] **Unit tests** (Vitest): 51 tests → 99 tests (incluyendo schema validation)
- [x] **E2E tests** (Playwright): 18 tests passing
- [x] **Manual QA**: Verificado en sitios con GTM, sin GTM, SPAs, múltiples containers

---

## Fase 2 — Diferenciación

> Objetivo: Features que ningún competidor ofrece. La extensión pasa de "viewer" a "QA tool".

### 2.1 — Export JSON ✅

**Entregable**: Exportar eventos capturados como archivo JSON.

- [x] Botón "Export JSON" en toolbar del DevTools panel
- [x] Opciones de export:
  - Todos los eventos vs solo los filtrados
  - Formato: "raw" (tal como se capturó) vs "clean" (sin metadata interna)
  - Incluir/excluir timestamp y URL
- [x] Genera archivo `.json` descargable con nombre: `datalayer-{domain}-{timestamp}.json`
- [x] Formato del archivo:
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
- [x] Keyboard shortcut: `Cmd+Shift+E` / `Ctrl+Shift+E`

### 2.2 — Schema Validation ✅

**Entregable**: Validar eventos del dataLayer contra esquemas definidos por el usuario.

> **Killer feature** — Ningún competidor lo tiene. Transforma la extensión de "viewer" a "QA tool".

- [x] **Template-based validation**:
  - Users define expected JSON structure with type placeholders (`@string`, `@number`, `@boolean`, `@array`, `@object`, `@any`)
  - Literal values must match exactly
  - Arrays validate each element against first element pattern
  - Nested objects validate recursively

- [x] **Schema definition UI**:
  - SchemaList panel: view all schemas with toggle/edit/delete
  - SchemaEditor: name, description, JSON template textarea
  - Type placeholders help section in editor
  - Schemas stored in `chrome.storage.local`

- [x] **Schema format** (JSON stored in `chrome.storage.local`):
  ```typescript
  interface Schema {
    id: string;
    name: string;
    template: TemplateObject;  // JSON with @type placeholders
    enabled: boolean;
    description?: string;
    createdAt: number;
    updatedAt: number;
  }
  ```

- [x] **Real-time validation**:
  - Each event validated against all enabled schemas whose template.event matches
  - Result per event: ✅ pass, ❌ fail, ○ none (no matching schema)
  - Validation badge in timeline (green check / red X)
  - Click badge to see validation details

- [x] **Validation detail view**:
  - ValidationErrors panel shows all errors for selected event
  - Each error shows: path, message, expected vs actual value
  - Visual hierarchy by schema

- [x] **Create schema from event**:
  - Right-click any event → creates schema with type placeholders auto-generated
  - `eventToTemplate()` converts real values to `@type` placeholders

- [x] **Import/Export schemas**:
  - Export all schemas as JSON file
  - Import schemas from JSON file (merges with existing)

- [x] **Core implementation**:
  - `schema-validator.ts`: validateEvent(), validateEventAgainstSchema(), schemaMatchesEvent(), eventToTemplate()
  - 35 unit tests covering all validation scenarios
  - Schemas slice in Zustand store
  - useSchemas + useValidation hooks

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

| Milestone                 | Entregable                                    | Dependencias | Status |
| ------------------------- | --------------------------------------------- | ------------ | ------ |
| **1.1** Scaffold          | Build funcional, instalable en Chrome         | —            | ✅ |
| **1.2** Captura           | dataLayer.push() interceptado, eventos fluyen | 1.1          | ✅ |
| **1.3** Service Worker    | Estado por tab, message routing               | 1.2          | ✅ |
| **1.4** DevTools Panel    | Timeline + JSON tree view                     | 1.3          | ✅ |
| **1.5** Search/Filter     | Búsqueda y filtros en timeline                | 1.4          | ✅ |
| **1.6** Multi-Container   | Múltiples GTM containers + custom DL          | 1.2          | ✅ |
| **1.7** Copy/Export       | Copiar eventos al clipboard                   | 1.4          | ✅ |
| **1.8** Popup             | Vista rápida sin DevTools                     | 1.3          | ✅ |
| **1.9** Settings          | Configuración persistente                     | 1.4          | ✅ |
| **1.10** QA Fase 1        | Tests + validación manual                     | 1.1–1.9      | ✅ |
| **2.1** Export JSON       | Descargar archivo JSON                        | 1.7          | ✅ |
| **2.2** Schema Validation | Validar contra schemas definidos              | 1.4          | ✅ |
| **2.3** Diff View         | Comparar snapshots side-by-side               | 1.4          | ⏳ |
| **2.4** Export Tests      | Generar Playwright/Cypress assertions         | 1.7, 2.2     | ⏳ |
| **2.5** Export Evidence   | Generar PNG/PDF de evidencia para Analytics   | 1.4          | ⏳ |
| **2.6** QA Fase 2         | Tests + validación manual                     | 2.1–2.5      | ⏳ |

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
