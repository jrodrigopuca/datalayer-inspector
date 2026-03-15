# Strata — Competitive Research & Opportunities

> Investigación realizada el 15 de marzo de 2026

## Landscape Competitivo

Hay ~12 extensiones activas en la Chrome Web Store para inspeccionar el `dataLayer`.

### Top Extensions por Usuarios

| Extensión                                   | Usuarios | Rating | Reviews | Tamaño | Diferenciador clave                                                 |
| ------------------------------------------- | -------- | ------ | ------- | ------ | ------------------------------------------------------------------- |
| **Datalayer Checker** (sublimetrix)         | 100K     | 4.5★   | 48      | 186KB  | Snapshots (hasta 100), search, vistas JSON/tabla                    |
| **Analytics Debugger** (thyngster)          | 100K     | 4.6★   | 229     | 300KB  | Multi-vendor (GA, Adobe, Piwik, pixels), SSOT, GTM Preview Enhancer |
| **Adswerve Inspector+**                     | 90K      | 4.1★   | 59      | 518KB  | Respaldo empresarial, GA hit inspection, code injection             |
| **dataslayer** (open source, MIT)           | 70K      | 4.5★   | 84      | 420KB  | Multi-TMS (GTM, DTM, Tealium, TagCommander), iframes                |
| **Simple Data Layer Viewer** (datapip)      | 20K      | 4.8★   | 17      | 210KB  | Ultra limpia, customizable, popup + DevTools, request rewrite       |
| **DataLayer Checker Plus** (Growth Academy) | 20K      | 4.9★   | 68      | 76KB   | Ultra-ligera, soporte Shopify Custom Pixel, color-coded types       |

### Extensiones Emergentes

| Extensión                 | Rating           | Diferenciador                                          |
| ------------------------- | ---------------- | ------------------------------------------------------ |
| **TAGLAB** (taglab.net)   | 5.0★ (6 reviews) | 35+ tipos de tags decodificados, marketing pixel audit |
| **LeoMeasure**            | 5.0★             | GTM inject + Shopify pixel fix                         |
| **dataLayer Explorer**    | 5.0★             | Análisis para devs y marketers                         |
| **GTM Watson**            | 5.0★             | Eventos real-time, copy, CSS selectors                 |
| **TagHound**              | 4.8★             | GA4, GTM, Google Ads, Facebook + 18 ad platforms       |
| **dataLayer Digger Plus** | 0.0★             | Filtros, export, análisis real-time                    |
| **DataLayer Monitor**     | 0.0★             | Monitoreo de cambios en GTM dataLayer                  |

### Referencia Open Source

- **dataslayer**: `github.com/sean-adams/dataslayer` — React + CRA, Google Data Layer Helper Library, MIT, 81 stars
- **Analytics Debugger**: `github.com/analytics-debugger/analytics-debugger-browser-extension`

---

## Pain Points (extraídos de reviews reales)

### P1: Manifest V3 rompió todo ★★★★★

La transición a Manifest V3 fue un desastre para los incumbentes:

- **Datalayer Checker** ELIMINÓ la funcionalidad de GTM injection por restricciones de MV3
  - Review: _"The latest update to remove GTM injection is a disaster. I was using that feature everyday"_ — Dave Mitchell ★★
- **Adswerve** cambió el workflow para insertar GTM containers, confundió a usuarios
  - Review: _"Adswerve did a poor job moving to MV3 cuz doing gtm redirections with MV3 is quite simple"_ — cthasika ★★
- Múltiples extensiones se rompieron durante la transición

**Oportunidad**: Construir MV3-native desde el día uno. Implementar GTM injection via `chrome.declarativeNetRequest` o inyección de código.

### P2: Bugs de carga / Confiabilidad ★★★★☆

- **Datalayer Checker v3**: queda cargando infinitamente después de la actualización
  - Review: _"Stopped working after the update. Just keeps on loading"_ — Steven ★
  - Review: _"was great but not work anymore. keep loading"_ — Taoufiq ★★★
- **dataslayer**: deja de mostrar eventos nuevos después de un tiempo
  - Review: _"After some time, it stops displaying newly sent events. Temporarily resolved when I restart DevTools, but clears previously loaded data layers"_ — Keyur ★★★

**Oportunidad**: Confiabilidad como feature principal. Service worker correctamente implementado.

### P3: Datos incorrectos ★★★★☆

- **dataslayer** atribuye eventos a URLs equivocadas durante navegación
  - Review: _"It displays false results. I'm on URL A and I click a button. According to Dataslayer? It happened on URL B"_ — Nick Vincent ★

**Oportunidad**: Atribución correcta de URL/timing usando `onCommitted`/`onBeforeNavigate` lifecycle events.

### P4: Multi-layer roto ★★★☆☆

- **dataslayer**: el dropdown para filtrar entre layers no funciona
  - Review: _"Can only view the first available data layer, the drop down to filter between layers is broken"_ — Chris Hogan ★★★

**Oportunidad**: Soporte multi-container como feature core, bien testeado.

### P5: UX pobre ★★★★☆

- Review de dataslayer: _"The interface is really awkward. It would be nice to rework how the data is presented. Becomes hard to work with"_
- Review de Adswerve: _"Designed in such an idiotic way that you have to read documentation to get it to work"_
- Adswerve: badge "NEW" parpadeando en toolbar — _"Please don't put flashing 'new' notifications"_

**Oportunidad**: UI moderna, intuitiva. Sin docs necesarios. Nivel de polish de React DevTools.

### P6: Ad blockers interfieren ★★☆☆☆

- Review de Datalayer Checker: _"You just need to disable adblockers or shields (in Brave)"_

**Oportunidad**: Cero dependencias externas. Compatible con ad blockers y navegadores como Brave.

### P7: Over-engineering ★★★☆☆

- Review: _"These extensions should be so simple, yet these clueless companies make them much more complicated than they need to be"_

**Oportunidad**: Progressive disclosure — simple por defecto, potente cuando se necesita.

---

## Feature Gap Analysis

### Lo que TODOS ofrecen (table stakes)

- Ver dataLayer pushes en real-time
- Timeline básico de eventos
- Renderizado de JSON tree
- Algún nivel de decodificación de GA hits
- Panel en DevTools o popup

### Lo que NADIE ofrece (espacio de oportunidad)

#### GAP 1: Schema Validation / Spec Compliance ★★★★★

**Ninguna extensión valida dataLayer pushes contra un esquema predefinido.** Los usuarios pueden VER datos pero no verificar si están CORRECTOS.

Posibles implementaciones:

- Validar contra schemas de eventos recomendados de GA4
- Schemas JSON custom (uploadables)
- Estructura esperada de ecommerce data
- Indicadores visuales ✅/❌ en tiempo real

**Impacto**: Atrapa tracking mal configurado ANTES de que llegue a GA4. Transforma la herramienta de "viewer" a "QA tool".

#### GAP 2: Diff/Compare entre estados ★★★★☆

Datalayer Checker tiene snapshots pero NO tiene diff. Ninguna extensión compara:

- Estado del dataLayer entre diferentes páginas
- Antes/después de un cambio de código
- Pushes esperados vs reales

**Impacto**: Crítico para workflows de QA.

#### GAP 3: Export como assertions de testing E2E ★★★★☆

Ninguna extensión genera assertions de test. Podría:

- Exportar eventos observados como assertions de Playwright/Cypress
- Generar test helpers desde datos capturados
- Grabar y reproducir secuencias esperadas de dataLayer

**Impacto**: Conecta QA de analytics con testing de desarrollo.

#### GAP 4: Vista especializada de Ecommerce ★★★☆☆

Solo DataLayer Checker Plus tiene soporte básico de Shopify. Falta:

- Visualización dedicada de items arrays
- Vista de purchase funnels
- Validación de campos requeridos de ecommerce

**Impacto**: Nicho de alto valor (ecommerce = donde se gasta dinero en analytics).

#### GAP 5: AI-Assisted Analysis ★★★☆☆

Ninguna extensión usa AI para:

- Explicar qué hace el dataLayer en lenguaje simple
- Sugerir fixes para misconfiguraciones comunes
- Identificar eventos recomendados faltantes

**Impacto**: Baja la barrera para usuarios no técnicos.

#### GAP 6: Team Collaboration / Reportes ★★★☆☆

Export limitado. Ninguna soporta:

- Reportes compartibles (link/PDF)
- Schemas compartidos de equipo
- Integración CI/CD para checks automáticos

**Impacto**: Propuesta de valor enterprise.

#### GAP 7: Consent/Privacy Layer Awareness ★★★☆☆

Ninguna muestra:

- Relación entre consent state y tags que se disparan
- Qué eventos se disparan antes/después del consentimiento
- Indicadores de compliance GDPR

**Impacto**: Crítico para auditoría de compliance en EU.

#### GAP 8: Performance Impact View ★★☆☆☆

Ninguna muestra:

- Tiempo por dataLayer push
- Impacto en performance de la página
- Waterfall de ejecución de tags

#### GAP 9: TypeScript Type Generation ★★☆☆☆

Ninguna ayuda a devs generando:

- Interfaces TypeScript desde eventos observados
- Helpers type-safe para `dataLayer.push()`

#### GAP 10: Multi-browser ★★☆☆☆

Solo dataslayer soporta Firefox oficialmente además de Chrome.

---

## Estrategia de Diferenciación Recomendada

### Identidad

**"Strata"** — La herramienta que desarrolladores y analistas técnicos QUIEREN usar, no otro viewer genérico.

### Phase 1 — MVP

1. Real-time dataLayer monitoring (panel de DevTools)
2. UI moderna y limpia (tree view + JSON raw, colores por tipo de dato)
3. Atribución correcta de URLs/eventos
4. Search y filter de eventos (por nombre de evento, key, valor)
5. Multi-container support (GTM, custom dataLayers)
6. Copy eventos individuales o timeline completo (JSON)
7. Zero dependencias externas (funciona con ad blockers)
8. Manifest V3 nativo desde día uno

### Phase 2 — Diferenciación

1. **Schema validation** — definir eventos esperados, validar en real-time con ✅/❌
2. **Diff view** — comparar snapshots lado a lado
3. **Export como test assertions** — generar código Playwright/Cypress
4. **Ecommerce mode** — vista especializada para purchase funnels

### Phase 3 — Visión

1. AI-assisted analysis
2. Team sharing / reportes
3. CI/CD integration
4. Consent layer awareness

---

## Stack Técnico Sugerido

| Aspecto              | Decisión                   | Razón                                    |
| -------------------- | -------------------------- | ---------------------------------------- |
| **Framework**        | React 19 + TypeScript      | Probado por dataslayer, pero modernizado |
| **Build**            | Vite                       | Rápido, moderno (CRA está deprecated)    |
| **Manifest**         | V3 nativo                  | Service worker, sin background page      |
| **UI principal**     | Panel de DevTools          | Como dataslayer/Analytics Debugger       |
| **UI secundaria**    | Popup quick-glance         | Vista rápida sin abrir DevTools          |
| **DataLayer helper** | `google/data-layer-helper` | Probada, usada por dataslayer            |
| **Licencia**         | GPLv3                      | Ya elegida en el repo                    |
| **Tamaño target**    | <200KB                     | Más ligera que la mayoría                |

---

## Conclusiones

1. El mercado está **fragmentado** — muchas extensiones, ninguna dominante, la mayoría con problemas serios
2. La transición a Manifest V3 creó una **ventana de oportunidad** — los players establecidos fallaron en la migración
3. **Schema validation es el killer feature** que nadie tiene — cambia la herramienta de "viewer" a "QA tool"
4. La UX developer/técnica está **desatendida** — la mayoría apunta a marketers con popups básicos
5. El open source (dataslayer) prueba que hay mercado pero no ha innovado más allá del update a MV3
6. Shopify/ecommerce es un **nicho desatendido** dentro de este espacio
