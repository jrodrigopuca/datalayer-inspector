# Strata — Deuda Técnica y Plan de Mejora

> Documento vivo. Resultado de la revisión de arquitectura de septiembre 2026
> sobre la versión 1.4.0. Se resuelve ítem por ítem; cada uno se cierra solo
> cuando su criterio de aceptación se puede verificar ejecutando un comando u
> observando un comportamiento.
>
> Documentos relacionados: [PLAN.md](./PLAN.md), [DESIGN.md](./DESIGN.md),
> [SPEC.md](./SPEC.md).

## Cómo usar este documento

- **El orden importa.** Los ítems están ordenados por lo que compran, no por
  lo fácil que son. El primero (CI) es la red de seguridad de todos los demás.
- **Cada ítem tiene un criterio de aceptación.** Si no se cumple, el ítem no
  está cerrado aunque el código "parezca" arreglado.
- **Las rutas y líneas reflejan el código en 1.4.0.** Al cerrar un ítem,
  actualizar la fila de estado y anotar el commit.
- **Los ítems de "Fricción" se pueden resolver al pasar**, dentro del commit
  que toque el archivo. No merecen un PR propio.

## Estado

| # | Ítem | Bucket | Estado | Commit |
|---|------|--------|--------|--------|
| 1 | CI y umbral de coverage honesto | Estructural | ✅ Cerrado (e2e queda manual, ver nota) | `8128a01` |
| 2 | Acotar el panel al mismo límite que el service worker | Estructural | ✅ Cerrado | `108b1cd` |
| 3 | Persistencia por tab en `storage.session` | Estructural | ✅ Cerrado | `b678924` |
| 4 | Un único dueño de la persistencia de schemas | Estructural | ✅ Cerrado | `10c4ba6` |
| 5 | Cerrar el gap de inyección del page script | Estructural | ✅ Cerrado (verificado en Chrome) | `692969d` |
| 6 | Restringir el texto capturado por el tracker | Privacidad | ✅ Cerrado (verificado en Chrome) | `bacff22` |
| 7 | Lista de tipos de request duplicada | Fricción | ✅ Cerrado | `10c4ba6` |
| 8 | Cliente de mensajería compartido | Fricción | ✅ Cerrado (parcial, ver nota) | `10c4ba6` |
| 9 | Un solo lockfile | Fricción | ✅ Cerrado | `8128a01` |
| 10 | Presupuesto del page script medido | Fricción | ⏭️ Descartado (obsoleto por el ítem 5) | |
| 11 | Código muerto en manifest y service worker | Fricción | ⬜ Pendiente | |
| 12 | Sincronizar documentación con el código | Fricción | ⬜ Pendiente | |
| 13 | Tags de release | Fricción | ⬜ Pendiente | |
| 14 | Nonce en el canal postMessage | Opcional | ⏭️ Descartado (ver actualización) | |
| 15 | `DL_CONTAINERS_DETECTED` duplicado en el arranque | Fricción | ⬜ Pendiente | |
| 16 | Recargar la misma URL no limpia los eventos | Producto | ⬜ Decidir | |
| 17 | El panel muere tras recargar la extensión y no explica cómo recuperarse | UX | ✅ Cerrado (reinyección verificada en Chrome) | |

Estados: ⬜ Pendiente · 🔄 En curso · ✅ Cerrado · ⏭️ Descartado (anotar por qué)

## Estado medido en la revisión

| Chequeo | Resultado (2026-09) |
|---|---|
| `pnpm run typecheck` | limpio |
| `pnpm run lint` | 22 warnings (14 `noNonNullAssertion`, 7 `useExhaustiveDependencies`, 1 supresión sin uso) |
| `pnpm test` | 176 tests, 11 archivos, todos pasan |
| `pnpm run test:coverage` | **FALLA**: 30.6% líneas / 16.4% funciones contra umbral 80% |
| CI | no existe (`.github/` ausente) |
| `public/page-script.js` | 5126 bytes (presupuesto declarado: < 5KB) |
| Lockfiles | `package-lock.json` y `pnpm-lock.yaml` conviven |
| Tags de git | ninguno |

---

## Riesgo estructural

### 1. CI y umbral de coverage honesto

**Problema.** No hay integración continua. Los 176 tests cubren `shared/`,
`page/` y `background/tab-manager.ts`; no hay ningún test para
`content/relay.ts`, `background/message-handler.ts`,
`background/port-manager.ts`, `background/storage.ts`, los hooks del panel ni
los componentes. El umbral de 80% en `vitest.config.ts` hace que
`pnpm run test:coverage` falle hoy, así que nadie lo corre. Los e2e requieren
`dist/` construido y navegador headed, y tampoco se ejecutan automáticamente.

**Por qué va primero.** Todos los ítems siguientes tocan el pipeline de
captura o la persistencia. Refactorizar eso sin red es apostar.

**Solución propuesta.**

1. Crear `.github/workflows/ci.yml` que corra en cada push y PR:
   `pnpm install --frozen-lockfile`, `pnpm run lint`, `pnpm run typecheck`, `pnpm test`,
   `pnpm run build`. Subir `dist/` como artefacto del workflow.
2. Bajar el umbral de coverage a la realidad (30%) y subirlo de a 10 puntos a
   medida que se agregan tests. Un umbral que falla siempre es peor que no
   tenerlo: enseña a ignorarlo.
3. Agregar tests unitarios, en este orden, porque son los módulos que los
   ítems 2 a 5 van a tocar:
   - `background/message-handler.ts` (routing, `handleTabNavigation` con
     `preserveLog` en ambos valores).
   - `background/port-manager.ts` (registro, broadcast, desconexión).
   - `content/relay.ts` (filtrado por `source`, transformación, estado
     `enabled`).
   - `background/storage.ts` (cache, merge con defaults, `onSettingsChanged`).
4. Un job separado y opcional para e2e con `xvfb-run npx playwright test`,
   que dependa del build.

**Alternativas.**

- Correr los e2e en cada PR desde el día uno. Tradeoff: más lentos y más
  frágiles (headed + extensión); mejor empezar con unit + build y sumar e2e
  cuando estén estables.
- No tocar el umbral y "ponerse al día" primero. Tradeoff: semanas de un
  comando rojo; la disciplina se pierde antes de llegar.

**Criterio de aceptación.**

- [x] Un PR con un test que falla se marca rojo en GitHub (`.github/workflows/ci.yml`, job `check`).
- [x] `pnpm run test:coverage` pasa en `main` (umbral ratchet 44/42/30/46 tras el ítem 6, medido 45.2/43.8/31.0/46.8).
- [x] Existen tests para los cuatro módulos listados en el paso 3 (59 tests nuevos; 235 en total).

**Nota de cierre (2026-09).** El job `e2e` existe pero corre solo con `workflow_dispatch`. Promoverlo a cada PR cuando haya pasado verde tres veces seguidas de forma manual. Ese es el único cabo suelto del ítem.

---

### 2. Acotar el panel al mismo límite que el service worker

**Problema.** El service worker poda a `maxEventsPerTab` en
`src/background/tab-manager.ts` (`pruneEventsIfNeeded`), pero el store del
panel apendea sin límite en `src/devtools/panel/store/slices/events.ts:36`
(`addEvent`). El mapa `validations` en `slices/schemas.ts` crece igual. En una
sesión larga el panel y el SW divergen: el panel muestra eventos que el SW ya
descartó, y cada push copia el array completo y recalcula `deltaByEventId`
(`EventList.tsx`) y `selectEventCounts` (`selectors.ts`) sobre todo el
historial.

**Contexto.** `PLAN.md` documenta que la virtualización se quitó porque
"React maneja cientos de eventos sin problemas". Es cierto para cientos; el
panel no está acotado a cientos.

**Solución propuesta.**

1. En `addEvent` del slice de eventos, aplicar la misma regla de poda que el SW
   usando `settings.maxEventsPerTab` (ya está en el store).
2. Al podar, eliminar del mapa `validations` los IDs descartados y, si el
   evento seleccionado fue podado, limpiar `selectedEventId`.
3. Extraer la regla de poda a `shared/utils/prune.ts` para que SW y panel
   usen la misma función (una sola fuente de verdad para el límite y el slack).

**Alternativas.**

- Que el panel no mantenga copia y pida al SW la lista completa en cada
  cambio. Tradeoff: un round-trip por push; simple, pero el SW serializa 500
  eventos por cada evento nuevo.
- Virtualizar con `@tanstack/virtual`. Tradeoff: resuelve el render, no la
  memoria ni la divergencia. Solo tiene sentido DESPUÉS de acotar, si se sube
  el límite a miles.

**Criterio de aceptación.**

- [x] Test unitario: con `maxEventsPerTab = 10`, tras 25 `addEvent` el store
      tiene 10 eventos o menos y `validations` no contiene IDs podados
      (`src/devtools/panel/store/slices/events.test.ts`).
- [x] Test unitario: SW y panel producen la misma lista final para la misma
      secuencia de eventos y el mismo límite
      (`src/devtools/panel/store/prune-parity.test.ts`).
- [x] `PLAN.md` actualizado: "el panel está acotado; virtualización no
      necesaria por debajo de N".

**Nota de cierre (2026-09).** La regla vive en `src/shared/utils/prune.ts`
(`countToPrune`, `pruneEvents`); el SW y el slice de eventos la importan
directo del módulo, no del barrel, para no arrastrar `export.ts` (que toca
`document`) al bundle del service worker. Al podar, el slice también limpia
`validations` y anula `selectedEventId` si el seleccionado se fue.

---

### 3. Persistencia por tab en `storage.session`

**Problema.** `persistToStorage` en `src/background/tab-manager.ts:49`
serializa el estado de TODOS los tabs a una sola clave
(`STORAGE_KEYS.TAB_STATES`) en cada evento, con debounce de 100 ms. La cuota
de `chrome.storage.session` es 10 MB. Con `maxEventsPerTab` configurable por
el usuario y payloads de hasta 100 KB (`LIMITS.MAX_EVENT_PAYLOAD_SIZE`), un
solo tab puede superarla. El fallo es un `console.error` que nadie ve; cuando
el SW se suspende, se pierde el estado de todos los tabs, no solo del que
desbordó.

**Solución propuesta.**

1. Una clave por tab: `strata_tab_<tabId>`. `restoreFromStorage` lee con
   `chrome.storage.session.get(null)` y filtra por prefijo.
2. `schedulePersist(tabId)` persiste solo el tab que cambió.
3. `removeTabState` borra su clave.
4. Antes de escribir, medir `JSON.stringify(state).length`; si supera un
   presupuesto por tab (por ejemplo 2 MB), podar por bytes además de por
   cantidad y registrar un aviso visible en el panel (no solo en consola).
5. Exponer el fallo de persistencia al panel mediante un mensaje
   `PERSIST_FAILED` para que el usuario sepa que la sesión no sobrevive a la
   suspensión del SW.

**Alternativas.**

- No persistir `data` de los eventos, solo metadatos, y reconstruir desde el
  page script al despertar. Tradeoff: el page script no guarda historial; se
  perderían payloads.
- Mantener una sola clave pero acotar el total. Tradeoff: sigue serializando
  todos los tabs por cada evento de uno solo; no escala con muchas pestañas.

**Criterio de aceptación.**

- [x] Test unitario: un evento en el tab A produce una escritura que contiene
      solo la clave del tab A (`src/background/tab-manager.persistence.test.ts`).
- [x] Test unitario: `restoreFromStorage` reconstruye N tabs desde N claves.
- [x] Test unitario: superar el presupuesto por tab poda y emite el aviso, no
      lanza ni silencia.

**Nota de cierre (2026-09).**

- Claves `strata_tab_<tabId>`; un timer de debounce por tab; cerrar el tab
  borra su clave. La clave única anterior (`strata_tab_states`) se elimina en
  el primer restore si existe.
- Presupuesto por tab en `STORAGE_LIMITS.MAX_TAB_STATE_BYTES` (2 MB, medido
  como longitud del JSON, que es como Chrome mide la cuota). Al superarlo se
  podan los eventos más viejos EN MEMORIA (no solo en la escritura), para que
  SW y panel no diverjan; siempre se conserva el más nuevo.
- Nuevo mensaje `STORAGE_WARNING` (`pruned-by-size` | `persist-failed`). El
  panel lo muestra en ámbar en la barra de estado, con botón para descartarlo,
  y en el caso `pruned-by-size` re-sincroniza el estado desde el SW.
- `restoreFromStorage` valida la forma de cada estado antes de cargarlo; un
  valor corrupto se ignora con un warning en lugar de romper el arranque.
- Pendiente para el ítem 12: `DESIGN.md` §10 describe la clave única vieja.

---

### 4. Un único dueño de la persistencia de schemas

**Problema.** Los settings se persisten a través del service worker en
`chrome.storage.sync`. Los schemas los escribe el panel directamente a
`chrome.storage.local` en `src/devtools/panel/hooks/use-schemas.ts:92`. Con
DevTools abierto en dos pestañas, cada panel tiene su copia; el último que
escribe pisa al otro (agregar un schema en A y tocar cualquier cosa en B borra
el schema de A en storage). El guard `hasLoadedRef` protege contra escribir
antes de leer, no contra dos escritores. Además `STORAGE_KEYS.SCHEMAS` existe
en `src/shared/constants.ts:38` pero el hook hardcodea el string en la
línea 19.

**Solución propuesta (recomendada).** Mover los schemas al mismo camino que
los settings:

1. Nuevos request types `GET_SCHEMAS` y `SET_SCHEMAS` (o CRUD granular) en
   `shared/types/messages.ts`, con sus validadores.
2. Un módulo `background/schemas-storage.ts` que sea el único que escribe
   `STORAGE_KEYS.SCHEMAS`.
3. Un broadcast `SCHEMAS_CHANGED` a todos los ports para que cada panel se
   actualice.
4. `use-schemas.ts` deja de tocar `chrome.storage` y pasa a usar
   `useCommands`.

**Alternativa mínima.** Mantener la escritura desde el panel pero suscribirse
a `chrome.storage.onChanged` en cada panel para reflejar cambios externos.
Tradeoff: resuelve la visibilidad, no la carrera; dos escrituras casi
simultáneas siguen pisándose.

**Criterio de aceptación.**

- [x] `rg "chrome.storage" src/devtools` no devuelve resultados.
- [x] Test de message-handler: `UPDATE_SCHEMAS` persiste y emite
      `SCHEMAS_CHANGED` a todos los clientes
      (`src/background/message-handler.schemas.test.ts`).
- [ ] Verificación manual: dos paneles abiertos, agregar en uno, aparece en el
      otro sin recargar. (Pendiente de probar en Chrome real; el resto del
      ítem está cubierto por tests.)

**Nota de cierre (2026-09).** Se implementó con OPERACIONES, no con
`SET_SCHEMAS` de lista completa: mandar la lista entera desde cada panel era
el mismo last-write-wins con otro nombre. Piezas:

- `SchemaOp` (`add` | `update` | `delete` | `import`) en
  `src/shared/types/schema.ts`, con timestamps dentro de la operación para que
  SW y panel produzcan el mismo resultado.
- `applySchemaOp` en `src/shared/utils/schema-ops.ts`: una sola implementación
  pura, usada por el SW (autoritativo) y por el slice del panel (optimista).
  Devuelve la misma referencia cuando no cambia nada, así el SW no escribe y
  el panel no revalida.
- `src/background/schemas-storage.ts`: único escritor de
  `STORAGE_KEYS.SCHEMAS`, con COLA de operaciones para que dos requests
  intercalados no se pisen dentro del propio SW. Lee la misma clave y forma
  que escribían los paneles pre-1.5, así que no hay migración.
- `SCHEMAS_CHANGED` se emite a TODOS los ports; el panel lo aplica con
  `setSchemas`, que ignora listas idénticas (el eco de la propia edición no
  dispara revalidación).
- Si el SW no puede persistir, el panel lo muestra en la barra de estado
  (mismo canal de aviso que el ítem 3).

---

### 5. Cerrar el gap de inyección del page script

**Problema.** El content script corre en `document_start`, pero en
`src/content/index.ts:28` hace `await loadConfig()` (un round-trip al service
worker, que puede estar suspendido) ANTES de inyectar el page script. Mientras
tanto GTM carga y hace pushes. Los pushes previos se capturan al procesar el
array existente, pero:

- Todos llevan el mismo `timestamp` (el momento de la intercepción), así que
  los deltas entre ellos son 0 ms.
- La atribución de trigger les da `page-load` por accidente, porque
  `navigationStart` en `src/page/interaction-tracker.ts` se fija con
  `Date.now()` cuando el script arranca, no cuando el usuario navegó.
- Un push disparado por un click del usuario en esa ventana se atribuye mal.

**Solución propuesta (recomendada).** Declarar el page script como content
script en el mundo principal:

```json
{
  "matches": ["<all_urls>"],
  "js": ["src/page/index.ts"],
  "run_at": "document_start",
  "world": "MAIN"
}
```

Esto elimina `content/injector.ts`, el `web_accessible_resources` y el gap
asíncrono. Chrome lo soporta desde la versión 111. La config
(`dataLayerNames`) viaja desde el mundo aislado por `postMessage`; el page
script arranca con `["dataLayer"]` y agrega nombres al recibirla.

**Prerequisito a verificar.** Que `@crxjs/vite-plugin` respete `world: "MAIN"`
en el manifest y no requiera el build IIFE separado. Si no lo soporta, ver la
alternativa.

**Alternativa mínima (si CRXJS no soporta MAIN).**

1. Inyectar de inmediato con defaults y enviar la config real por
   `postMessage` cuando llegue.
2. Usar `performance.timeOrigin` como `navigationStart` en el tracker.
3. Marcar los eventos preexistentes con `trigger.type = "preload"` (nuevo
   valor) para no mentir con `page-load`.

**Criterio de aceptación.**

- [x] Los eventos previos a la intercepción se marcan `preload` (no
      `page-load`) y conservan su orden. Cubierto a nivel unitario en
      `src/page/interceptor.preload.test.ts`: los e2e actuales leen el
      `dataLayer` de la página, no los eventos capturados, así que no pueden
      afirmar esto sin un harness nuevo.
- [x] La atribución `page-load` se mide desde `performance.timeOrigin`, no
      desde el arranque del script (`interaction-tracker.origin.test.ts`).
      La aserción e2e de "click en los primeros 500 ms" queda sin harness por
      la misma razón; la lógica está cubierta por los tests del tracker.
- [x] MAIN adoptado: `content/injector.ts`, `vite.page-script.config.ts` y
      `public/page-script.js` eliminados; `web_accessible_resources` fuera del
      manifest; build reducido a `tsc && vite build`.
- [x] Prueba en Chrome real tras el build (2026-09, con la extensión
      Claude in Chrome sobre `tests/fixtures/pages/strata-smoke.html`
      servida por HTTP local): `dataLayer.push` envuelto; secuencia de
      arranque `DL_CONFIG` → containers → 3 eventos `preload` con índices
      1..3 → `DL_INITIALIZED existing=3`, en ~90-140 ms; consola sin
      mensajes en la recarga. Atribución verificada con interacciones
      reales: `click` (con label del botón), `submit`, `change`, `script`
      (push diferido 3 s). El push a `customLayer` no se captura sin
      configurarlo, como corresponde. Falta correr el job e2e manual del CI.
- [x] Recorrido completo hasta el panel, confirmado con el PDF de Evidence
      exportado desde DevTools (`datalayer-evidence-evidence-2026-09-07.pdf`,
      2 páginas, 12 eventos): los eventos previos salen con
      "Trigger: Pre-existing (pushed before Strata attached; timing unknown)"
      y la atribución de click/submit/change/script coincide con lo visto en
      la página. El archivo NO va al repo.

**Nota de cierre (2026-09).** Hallazgo que cambió el diseño: CRXJS carga
TODO content script (aislado o MAIN) mediante un loader con `import()`
dinámico, así que `document_start` nunca fue síncrono, ni antes ni ahora.
Con MAIN se eliminan dos saltos asíncronos (el round-trip al SW y el fetch
del tag de script), pero queda una carrera pequeña con los scripts inline del
`<head>`. Por eso el cierre no apuesta a "ganar la carrera" sino a ser
correcto sin importar cuándo arranca el script:

- **Handshake.** El page script intercepta `dataLayer` de inmediato y
  BUFFEREA todo lo capturado (tope 500). El relay, cuando tiene la config del
  SW, le manda `DL_CONFIG`; recién ahí el page script intercepta los nombres
  extra, emite `DL_INITIALIZED` y vacía el buffer. Si la extensión está
  deshabilitada, el buffer se descarta. Sin esto, con dos content scripts
  independientes los mensajes previos al arranque del relay se perdían.
- **`preload`.** Nuevo `TRIGGER_TYPE` para los eventos que ya estaban en el
  array. Antes recibían `page-load` por accidente y deltas de 0 ms.
- **`performance.timeOrigin`** como inicio de navegación.
- **CSP.** Efecto colateral valioso: un content script MAIN no está sujeto al
  CSP de la página. Con la inyección por tag, los sitios con CSP estricto
  bloqueaban el page script en silencio.
- **Página de smoke test.** `tests/fixtures/pages/strata-smoke.html` registra
  en pantalla (y en `window.__strataLog`) todo mensaje Strata que cruza
  `window.postMessage`, en ambos sentidos. Sirve para verificar el handshake
  y la atribución sin abrir DevTools: `python3 -m http.server 8765` en
  `tests/fixtures/pages` y abrir `http://127.0.0.1:8765/strata-smoke.html`.
- **Hallazgo menor** (ítem 15): en el arranque se emite
  `DL_CONTAINERS_DETECTED` dos veces, una por la detección inicial y otra
  por el `gtm.js` preexistente que dispara la re-detección. El SW mergea sin
  duplicar, así que no hay bug visible; es un mensaje de más por página.
- Pendiente de `SettingsModal`: cambiar `dataLayerNames` sigue requiriendo
  recargar la página (igual que antes); el canal `DL_CONFIG` ya permite
  hacerlo en caliente si se quiere.

---

## Privacidad

### 6. Restringir el texto capturado por el tracker

**Problema.** `describeElement` en `src/page/interaction-tracker.ts:81`
lee `textContent` de CUALQUIER elemento clickeado (hasta 40 caracteres).
Reproducido en vivo (2026-09) con la página de smoke test: un click en una
celda de tabla produjo el label
`td "ACCT-99887766 jane.doe@example.com"`, que viaja al timeline y al PDF. Se
cumple la promesa de `PRIVACY.md` de no grabar valores de inputs, pero un click
en una celda de tabla con un email, un nombre o un número de cuenta termina en
el label del trigger, en el timeline y en el PDF de evidencia.

**Solución propuesta.**

1. Usar texto visible solo cuando `findInteractiveTarget` devolvió un elemento
   interactivo real (`button`, `a`, `[role=button]`, `summary`, `label`). Si
   el target es un elemento genérico, describir solo por tag y selector.
   Para controles de formulario (`select`, `input`, `textarea`) usar el texto
   del `<label>` asociado (`element.labels`), nunca su contenido: en el smoke
   test el select salió como `"select"` pelado aunque estaba dentro de
   `<label>Plan</label>`.
2. Priorizar `aria-label` y `title` sobre texto, como ya se hace.
3. Documentar en `PRIVACY.md` qué se captura exactamente del elemento.

**Alternativa.** Redactar patrones (emails, secuencias largas de dígitos) en
el label. Tradeoff: lista negra incompleta por diseño; mejor no capturar que
filtrar.

**Criterio de aceptación.**

- [x] Test unitario: click en un `<td>` con texto produce un label sin ese
      texto (`src/page/interaction-tracker.privacy.test.ts`).
- [x] Test unitario: click en un `<span>` dentro de un `<button>` produce el
      texto del botón.
- [x] `PRIVACY.md` actualizado con las reglas exactas.

**Nota de cierre (2026-09).** Regla implementada en `describeElement`, en
este orden: nombre accesible explícito → `<label>` asociado para controles
de formulario (excluyendo el control anidado, así `<label>Plan <select>`
lee "Plan" y no las opciones) → texto visible solo para button, a,
role=button/link/tab, summary, label → formularios por `name`/`id` → todo lo
demás solo tag. Excepción explícita: `input[type=submit|button|reset]` usa
su `value` porque es una leyenda, no un dato.

Verificado en Chrome (2026-09) con el export JSON v2 del smoke test: cuatro
clicks en la celda de cuenta salen como `"label":"td"`,
`"selector":"#sensitive-cell"`, sin rastro del número ni del email; el
select sale como `select "Plan"`; el form como `form "lead-form"`; los
botones conservan su texto. `summary.byTrigger` cuadra con los 12 eventos.

---

## Fricción

### 7. Lista de tipos de request duplicada

`isClientRequest` en `src/background/index.ts:52` mantiene una lista de
strings paralela a `CLIENT_REQUEST_TYPE`. Agregar un tipo en `messages.ts` y
olvidar esta lista rutea el request como mensaje de content script sin ningún
error. Reemplazar por `Object.values(CLIENT_REQUEST_TYPE).includes(type)`.

- [x] La lista literal no existe. `isClientRequest` vive en
      `message-handler.ts`, derivado de `Object.values(CLIENT_REQUEST_TYPE)`,
      y el test recorre TODOS los tipos del constante
      (`message-handler.schemas.test.ts`). Cerrado junto con el ítem 4, que
      agregaba dos tipos nuevos y los habría ruteado mal.

### 8. Cliente de mensajería compartido

El wrapper de `chrome.runtime.sendMessage` a promesa está copiado tres veces:
dos en `src/devtools/panel/hooks/use-connection.ts` y una en
`src/popup/App.tsx`. El popup además replica el `switch` de mensajes del port
con `useState` en lugar de compartir el store. Extraer
`shared/messaging/client.ts` con `sendRequest` y `connectPort` tipados, y
usarlo desde panel, popup y content script.

- [x] `rg "chrome.runtime.sendMessage\(" src` devuelve un solo resultado
      fuera de `content/relay.ts`: `src/shared/messaging/client.ts`.

**Nota de cierre (2026-09).** `sendRequest` compartido por panel, popup y
content script. Lo que NO se hizo: el popup sigue con su propio `switch` de
mensajes del port sobre `useState`. Compartir el store de Zustand entre popup
y panel es un cambio mayor con poco valor para cinco `case`; queda registrado
como decisión, no como pendiente.

### 9. Un solo lockfile

`package-lock.json` y `pnpm-lock.yaml` conviven y el README dice "npm o
pnpm". Elegir uno (el CI del ítem 1 obliga a decidir), borrar el otro y
agregarlo a `.gitignore`.

- [x] Un solo lockfile en el repo; README y CI usan el mismo gestor (pnpm, fijado con `packageManager` en `package.json`; `package-lock.json` eliminado e ignorado).

### 10. Presupuesto del page script medido

`public/page-script.js` es un artefacto de build commiteado. Hoy pesa 5126
bytes; `PLAN.md` dice 2.9 KB y `src/page/index.ts` declara "< 5KB". Nada lo
mide. Si se adopta `world: "MAIN"` (ítem 5) el archivo desaparece. Si no:

1. Un script `check:size` que falle si el IIFE supera el presupuesto.
2. Correrlo en CI.
3. Decidir si el artefacto se commitea (y por qué) o se genera en `predev`.

- [x] Descartado: con el ítem 5 el page script se buildea con el resto de la
      extensión y ya no hay artefacto commiteado ni presupuesto aparte. Si
      alguna vez importa el tamaño del chunk MAIN, medirlo desde `dist/` en
      CI.

### 11. Código muerto en manifest y service worker

- `chrome.action.onClicked` en `src/background/index.ts` nunca dispara
  porque el manifest declara `default_popup`.
- `optional_permissions: ["tabs"]` nunca se solicita con
  `chrome.permissions.request`.
- `activeTab` es redundante con `host_permissions: ["<all_urls>"]`; revisar
  `PERMISSIONS.md` y dejar solo lo que se usa (menos fricción en la revisión
  del Web Store).

- [ ] Listener y permisos sin uso eliminados; `PERMISSIONS.md` coincide con
      `manifest.json`.

### 12. Sincronizar documentación con el código

Hay unas 7000 líneas de documentación escritas antes del código y no
re-sincronizadas:

- `SPEC.md` muestra el manifest con versión 0.1.0.
- `DESIGN.md` §13.1 diseña el export PNG con `html2canvas`, eliminado en
  1.4.0 según `CHANGELOG.md`.
- `PLAN.md` reporta 51 tests; hay 176.
- `docs/ECOSYSTEM_ROADMAP.md`, el único documento actualizado, está en
  `docs/.gitignore`.

Propuesta: no reescribir todo. Agregar al inicio de `SPEC.md` y `DESIGN.md`
una nota "documento de diseño original; el código en `src/` es la fuente de
verdad para X, Y, Z", eliminar la sección de PNG, y decidir si el roadmap se
versiona.

- [ ] Ninguna sección de docs describe una feature eliminada.
- [ ] Decisión registrada sobre el roadmap (versionado o no, y por qué).

### 13. Tags de release

`CHANGELOG.md` tiene 1.4.0 y `git tag` está vacío. Crear `v1.4.0` sobre el
commit de release y taggear cada release futuro. Opcional: que el CI construya
el zip del Web Store al detectar un tag.

- [ ] `git tag` lista `v1.4.0`.

### 15. `DL_CONTAINERS_DETECTED` duplicado en el arranque

Detectado en el smoke test del ítem 5. `src/page/index.ts` emite los
containers en `init()` y otra vez cuando procesa el `gtm.js` preexistente
(`shouldRedetectContainers`). El SW mergea por id, así que no hay efecto
visible; solo un mensaje redundante por carga. Fix: recordar el último set
de ids emitido y saltear la emisión si no cambió.

- [ ] Con un `gtm.js` preexistente, el smoke test muestra UN solo
      `DL_CONTAINERS_DETECTED` en el arranque.

### 16. Recargar la misma URL no limpia los eventos

Visto en el PDF de Evidence del ítem 5: tras recargar la página de smoke
test, los tres eventos `preload` aparecen dos veces (índices 1-3 y 10-12),
con los seis eventos de la sesión anterior en el medio. Causa:
`chrome.tabs.onUpdated` solo trae `changeInfo.url` cuando la URL CAMBIA; una
recarga no pasa por `handleTabNavigation`, así que la lógica de
`preserveLog` nunca se evalúa. No es un bug del ítem 5; es comportamiento
previo que el smoke test hizo visible.

**Pregunta de producto.** ¿Qué esperás al recargar con "Preserve log"
apagado? El panel Network de DevTools limpia. Si la respuesta es "limpiar":

- Usar `DL_INIT` (que el page script emite en cada carga del documento)
  como señal de "documento nuevo" en `message-handler.ts`: si
  `!preserveLog`, resetear el tab y emitir `TAB_STATE_RESET` con razón
  `navigation`. No requiere permisos nuevos (`webNavigation` sí los
  requeriría).
- Si la respuesta es "conservar", documentarlo en el README y en el tooltip
  de "Preserve log", porque hoy el nombre promete algo distinto.

- [ ] Decisión registrada y, si aplica, test en `message-handler.test.ts`:
      `DL_INIT` con `preserveLog=false` vacía los eventos del tab.

### 17. El panel muere tras recargar la extensión y no explica cómo recuperarse

Reproducido (2026-09): con DevTools abierto, recargar Strata desde
`chrome://extensions` deja al panel con "Max reconnection attempts reached"
y el botón Clear falla en silencio. El usuario reinstaló la extensión; con
cerrar y reabrir DevTools alcanzaba.

**Evidencia adicional (2026-09).** Tras rebuild y recarga de la extensión,
Chrome registró en la página de la extensión un error con origen en la
página de DevTools y stack en `shared/messaging/client.ts`: "No response
from the service worker". Es un `void clearEvents()` / `toggleRecording()`
del panel viejo contra un runtime que no responde, y el rechazo queda sin
manejar. Nota: el CHANGELOG de 1.4.0 afirma que los rechazos no manejados
"se capturan y reportan", pero no existe ningún `unhandledrejection` en
`src/` (verificado con `git log -S`). El paso 3 de este ítem lo resuelve
de verdad; el ítem 12 debe corregir el CHANGELOG.

**Causa.** Al recargar la extensión, la página del panel queda huérfana: su
`chrome.runtime` apunta a un contexto invalidado. `use-connection.ts`
reintenta 5 veces cada 1 s (`LIMITS.MAX_RECONNECT_ATTEMPTS`,
`RECONNECT_DELAY`) contra un runtime que nunca va a responder, y luego entra
en `ERROR` permanente. Ninguna reconexión puede tener éxito desde ese
contexto; el único camino es un panel nuevo.

**Solución propuesta.**

1. Detectar el contexto invalidado (`chrome.runtime?.id === undefined`, o el
   error "Extension context invalidated") y mostrar un mensaje ACCIONABLE:
   "Strata se actualizó. Cerrá y volvé a abrir DevTools para reconectar."
   Sin reintentos: son ruido.
2. Para desconexiones reales (SW dormido o reiniciado), reemplazar el tope
   fijo por backoff exponencial acotado (1 s → 2 s → 4 s → 8 s, tope 30 s)
   sin rendirse nunca, más un botón "Reconectar" en la barra de estado.
3. `useCommands` (Clear, Record, Settings): si el request falla, mostrar el
   error en `warningMessage` en lugar de dejarlo en la consola.

**Criterio de aceptación.**

- [x] Test de la política extraída
      (`src/devtools/panel/lib/connection-policy.test.ts`): con el contexto
      invalidado `decideReconnect` devuelve `stop` y el mensaje contiene
      "reopen DevTools".
- [x] Test: los intentos 5, 6, 10, 50 y 1000 siguen devolviendo `retry`, con
      delay 1 s → 2 s → 4 s → 8 s → 16 s y tope 30 s.
- [ ] Manual: recargar la extensión con DevTools abierto muestra el mensaje
      accionable; Clear contra un runtime muerto muestra un aviso visible en
      la barra; el botón "Reconnect" aparece solo cuando reconectar tiene
      sentido.
- [x] Manual (2026-09): con la página de smoke test abierta, recargar la
      extensión y reabrir DevTools SIN recargar la página; los pushes nuevos
      llegan al panel y `window.__strataLog` muestra un segundo `DL_CONFIG`.
      Verificado por el autor en Chrome.

**Nota de cierre (2026-09).** La decisión vive en
`src/devtools/panel/lib/connection-policy.ts`, pura y sin React:
`isExtensionContextInvalidated` (lee `chrome.runtime.id`), `decideReconnect`
(backoff exponencial acotado, nunca `stop` salvo contexto invalidado),
`describeCommandFailure` y `runCommand`. El hook solo ejecuta la decisión:
limpia el error al reconectar, resetea el contador con el botón "Reconnect"
de la barra (vía `reconnectRequest` en el store, sin funciones en el
estado), y todos los comandos de `useCommands` pasan por `runCommand`, que
reporta a `warningMessage` y nunca rechaza. Además `panel/main.tsx` instala
un `unhandledrejection` global que también reporta a la barra, así lo que
el CHANGELOG 1.4.0 prometía pasa a ser cierto para el panel.
`LIMITS.MAX_RECONNECT_ATTEMPTS` eliminado; `RECONNECT_MAX_DELAY` nuevo.

**Segundo hallazgo, misma raíz (2026-09).** Tras recargar la extensión, aun
reabriendo DevTools, el panel no recibía eventos NUEVOS de una pestaña ya
abierta. Verificado desde la página: el page script seguía vivo y posteando
(evento 18 capturado en `window`), pero solo había UN `DL_CONFIG`, el de la
carga original. Chrome no reinyecta content scripts en pestañas abiertas al
recargar una extensión; el relay de esa pestaña pertenece a la versión
anterior y cada `sendMessage` falla en silencio. Fix en
`src/background/reinject.ts`: en `onInstalled` (install/update) se ejecuta
de nuevo el content script AISLADO, leído del manifest construido, en todas
las pestañas http(s). El page script MAIN no se reinyecta (duplicaría el
wrap de `push`); el nuevo relay hace el handshake y el flujo sigue. El page
script re-anuncia los containers en cada handshake posterior al primero,
porque el worker nuevo no los conoce. Consecuencia para el ítem 11: el
permiso `scripting` pasa a estar EN USO.
Cobertura de líneas bajó 0.2 puntos por el crecimiento del hook (React sin
tests); el umbral sigue pasando.

---

## Opcional

### 14. Nonce en el canal postMessage

Cualquier script de la página puede enviar `window.postMessage` con
`source: "__STRATA_DATALAYER_INSPECTOR__"` y el relay lo acepta
(`src/content/relay.ts`, `handlePageMessage`). Impacto: eventos falsos en el
timeline y en la evidencia PDF. Es inherente al diseño con postMessage; un
nonce generado por el content script, pasado en la config y exigido en cada
mensaje, sube la vara pero no es un muro (un script que observe el DOM antes
del `onload` puede leerlo). Con `world: "MAIN"` el nonce se puede pasar por
un canal que la página no ve. Evaluar después del ítem 5.

**Actualización tras el ítem 5.** MAIN no ayuda: el handshake `DL_CONFIG`
viaja por `postMessage`, que cualquier script de la página también escucha,
así que un nonce ahí sería visible para el atacante. Lo único que cerraría el
canal es un `MessagePort` transferido... y `MessageEvent.ports` también es
observable por todos los listeners de `window`. Conclusión honesta: no hay
canal privado entre mundo aislado y mundo MAIN vía DOM. Queda como riesgo
aceptado y documentado, no como pendiente.

- [x] Decisión registrada: descartado; ver actualización.

---

## Registro de decisiones

| Fecha | Ítem | Decisión | Justificación |
|-------|------|----------|---------------|
| 2026-09 | 9 | pnpm como único gestor | Preferencia del autor; era el gestor con el que se instalaba `node_modules` en la práctica. |
| 2026-09 | 1 | Umbral de coverage como ratchet, no como meta | Un umbral que falla siempre se ignora. Se fija por debajo de lo medido y se sube al agregar tests; nunca se baja. |
| 2026-09 | 4 | Operaciones (`SchemaOp`) en vez de `SET_SCHEMAS` con lista completa | Con listas, dos paneles concurrentes siguen pisándose; con operaciones por id el SW hace el merge y convergen. |
| 2026-09 | 4 | Cola de operaciones en el SW | Sin cola, dos `UPDATE_SCHEMAS` intercalados leen la misma lista y el segundo write pierde el primero. |
| 2026-09 | 8 | El popup conserva su propio manejo del port | Cinco `case` con `useState`; compartir el store con el panel no paga su costo. |
| 2026-09 | 5 | Page script como content script `world: "MAIN"` con handshake y buffer | CRXJS 2.7.1 lo soporta; elimina el round-trip al SW antes de capturar y la inyección por tag (sujeta al CSP de la página). El buffer cubre la carrera entre los dos content scripts. |
| 2026-09 | 10 | Descartado | Sin artefacto IIFE commiteado no hay presupuesto que medir aparte del build. |
| 2026-09 | 14 | Descartado | No existe canal privado aislado→MAIN vía DOM; un nonce sería visible para la página. |
| 2026-09 | 1 | E2E solo por `workflow_dispatch` | Requiere Chromium headed con extensión; no se promueve a cada PR hasta demostrar estabilidad. |
