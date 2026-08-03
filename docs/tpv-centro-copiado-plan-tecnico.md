# TPV Centro de copiado — plan técnico

> 2026-08-01, rama `feat/tpv-centro-copiado`. Implementación del diseño
> [tpv-centro-copiado-diseno.md](tpv-centro-copiado-diseno.md). Punto de
> restauración: tag `v3.9-pre-tpv-centro-copiado` (código) +
> `backups/gdi_saas_pre_tpv_centro_copiado_20260801_110035.sql` (DB).

## 0. Hallazgos que bajan el riesgo (confirmados en código)

- **Sin migración de schema.** El tamaño por-cotización (D6) viaja en el
  `jobContext` (runtime), la agrupación va en JSON de ítems, y el producto
  plantilla es **data (seed) sobre tablas existentes**. El único toque a la DB
  dev es ese seed → cubierto por el dump.
- **D6 ya tiene hook.** `factorA4EquivalenteParaImpresionPorHoja`
  (`motor.service.ts:5428`) usa el pliego del nesting con **fallback a
  `jobContext.pliego_impresion_ancho_mm/alto_mm`** (`:5447`). Y el motor ya
  mergea `jobContext.configPasoRuntime[configPasoId].nestingConfig`
  (`:2495-2500`). El pliego por documento entra por ahí; falta sólo verificar
  que el nesting dispatcher honre el override runtime (Etapa B).
- **La matemática de impresión no se toca.** Pasando `cantidad=hojas` + `caras`,
  el motor ya da pliegos/clicks/desgaste/tóner/papel correctos (§2.1 del diseño).
- **El builder del ítem ya existe** para copiar: `snapshotJson`
  (`motor.service.ts:1129`), `trazabilidadJson` (`:1169`),
  `cotizacionItem.create` (`:1018`). El compuesto (Tomo-A) replica esa forma con
  costos sumados y pasos concatenados.

## 1. Etapas

Orden de dependencia: A → B → C → D → E → F. A y B son backend puro y
verificables por test antes de tocar UI.

### Etapa A — Producto plantilla "Impresión de documento" + provisión ✅ HECHA

**Objetivo:** un producto por tenant, idempotente, con la ruta que consume el TPV.

Implementado en:
- `apps/api/src/centro-copiado/provisionar-plantilla.ts` — función idempotente
  `provisionarPlantillaCentroCopiado(prisma, tenantId)` (fuente única).
- `apps/api/scripts/provisionar-centro-copiado.ts` — runner (ts-node).
- `apps/api/src/centro-copiado/__tests__/plantilla-cotizacion.spec.ts` —
  verificación contra el motor real en DB aislada (4 tests, verdes).

**Forma final del producto** (`codigo = SYS-IMPRESION-DOC`, subcategoría
`papeleria_comercial`, `por_margen` 40%/25% mín):
- Ruta `CC-IMPRESION-DOC` con **1 paso**: `impresion_por_hoja`. Anillado
  DIFERIDO (decisión usuario): se agrega cuando el taller cargue anilladora +
  anillos.
- Config del paso: `modoActivacion OBLIGATORIO`, `modoTiempo T-3`,
  `multiplicadoresActivos ['caras']`, `paramsPasoJson.nestingConfig.pliegoImpresion
  = A4` (márgenes 0).
- **Máquina M-2** (no M-1): candidatas resueltas por rol — color (láser con
  desgaste `soloColor`) con `modoColorAllowedModes ['CMYK']` + B/N (láser mono)
  con `['BN']`. El adaptador (Etapa C) setea
  `maquinaSeleccionada_<configPasoId>` según el color del documento; el motor NO
  auto-rutea por color.
- Slot `sustrato_principal` en `COMERCIAL_ELIGE` con candidatos = materias primas
  `SUSTRATO_HOJA` (`todasLasVariantes:true`); el papel viaja en
  `jobContext.slotMateriales['<configPasoId>_sustrato_principal']`.

**Correcciones vs. el plan original (importantes para Etapa B/C):**
1. `mecanismoCantidad` = **`CALCULADO_POR_PASO`**, NO `DIRECT`: la familia
   `impresion_por_hoja` sólo soporta nesting/HEREDAR. El truco "documento" vive
   en el adaptador: pasa `piezas` del tamaño del pliego (algo menor que A4 ⇒ 1
   pose/pliego) con `cantidad = hojas` ⇒ `pliegos_impresos = hojas`. Verificado.
2. El motor **exige un `RutaVersion`** con `snapshotJson = { pasos: [{orden,
   familia}] }` de la versión que apunta la ruta alternativa; sin él cotizar
   falla ("no tiene snapshot de versión"). El provisionador lo crea.
3. No hay flag `esSistema` en `Producto`; se distingue por `codigo` y la
   descripción. El seed vive como script/servicio, no en `prisma/seed`.
4. El papel se costea por **formato de compra** (pliego de impresión ≠ formato
   comprado): 12 A4 pueden ser 3 pliegos de compra. El motor lo hace bien.

**Verificado (spec, DB aislada):** cotiza OK; `pliegos_impresos == hojas` (12
doble faz / 24 simple); papel invariante a las caras (por hoja, no por carilla).
El ruteo color-vs-B/N se verificó estructuralmente en dev (el seed de test tiene
una sola láser).

**Pendiente menor:** el slot incluye los 4 papeles `SUSTRATO_HOJA` (2 son
stickers); el modal (Etapa E) presentará la lista curada de papeles de copiado.

### Etapa B — D6: pliego (tamaño) por-cotización ✅ HECHA (sin cambio de motor)

**Objetivo:** que A4/A3 por documento cambien `factorA4` y el pliego de impresión
sin config estática por tamaño.

**Hallazgo: el hook ya existía, no hizo falta tocar el motor.**
`resolveNestingConfig` (`nesting-config.ts:315-320`) lee el pliego de
`jobContext.configPasoRuntime[configPasoId].nestingConfig.pliegoImpresion` **con
precedencia** sobre `paramsPasoJson`. De ahí sale el pliego del nesting y, por
`factorA4EquivalenteParaImpresionPorHoja` (`motor.service.ts:5428`), los clicks.

Implementado en `apps/api/src/centro-copiado/pliegos.ts`:
- `CC_PLIEGOS` — presets A4 / A3 / Oficio / Carta (anchoMm × altoMm).
- `runtimePliegoImpresion(configPasoId, preset)` — fragmento de jobContext
  canónico (la forma exacta que consume el motor). Lo reusa el adaptador (Etapa C).
- `piezaDocumento(preset, hojas)` — pieza ~tamaño-pliego menos margen ⇒ 1
  pose/pliego ⇒ `pliegos = hojas`, para cualquier tamaño.

**Verificado** (`__tests__/pliego-por-cotizacion.spec.ts`): mismo documento como
A4 vs A3 ⇒ el pliego de impresión cambia (área A3 ≈ 2× A4 ⇒ `factorA4 = 2` ⇒ 2
clicks), y `pliegos_impresos == hojas` en ambos tamaños. No hizo falta el fallback
`pliego_impresion_*_mm` ni tocar `JobContextDto`.

### Etapa C — Adaptador + endpoint de preview ✅ HECHA

**Objetivo:** `POST /centro-copiado/cotizar` (preview en vivo, no persiste).

Implementado en `apps/api/src/centro-copiado/`:
- `adaptador.ts` — `calcularHojas(paginas, copias, faz)` +
  `construirSegmento(doc, ctx, copias)`: arma el `jobContext` del segmento
  (`cantidad=hojas`, `caras`, `modoColor`, `slotMateriales`,
  `maquinaSeleccionada_<id>` por color, pliego runtime de Etapa B).
- `dto/cotizar-centro-copiado.dto.ts` — `CotizarCentroCopiadoDto` (documentos +
  grupos, class-validator).
- `centro-copiado.service.ts` — provisiona lazy + resuelve contexto (configPasoId,
  máquina color/BN), cotiza cada documento, ensambla por-documento / por-tomo /
  totales (carillas, hojas físicas, subtotal, IVA, total). `periodo` param (null =
  mes actual en el endpoint; los tests fijan uno).
- `centro-copiado.controller.ts` — `POST /centro-copiado/cotizar`
  (`@Permiso('comercial.ver')`, `@OcultaMargenes()`, tenant de `req.auth`).
- `centro-copiado.module.ts` — registrado en `app.module.ts`.

**Desviaciones vs. el contrato §3 del diseño (intencionales):**
1. Los "valores por defecto / aplicar a todos" se resuelven en el FRONT; el
   backend recibe documentos ya resueltos. El DTO no lleva `defaults`.
2. Anillado DIFERIDO ⇒ un grupo (tomo) = **suma de sus segmentos de impresión**,
   sin línea de anillado (se sumará cuando el taller cargue anilladora + anillos).
   `hojasPorLibro` se calcula igual (Σ hojas de un juego) para el futuro anillado.
3. Un documento agrupado usa los `juegos` del tomo como copias efectivas.

**Errores por fila:** si un documento no cotiza (ej. papel/tarifa faltante) queda
con `error` y se excluye de los totales; el resto cotiza (total parcial).

**Verificado** (`__tests__/centro-copiado-preview.spec.ts`): escenario con 2
sueltos + 1 tomo (2 docs, 2 juegos) — aritmética exacta (carillas/hojas/pliegos),
agrupación (copias = juegos), `hojasPorLibro`, tomo.subtotal = Σ sus docs, y
totales. 6/6 tests centro-copiado verdes, `tsc` limpio.

### Etapa D — Persistencia: agregar a la orden ✅ HECHA

**Objetivo:** `POST /centro-copiado/agregar-a-orden` persiste la carga.

**Decisión de alcance (consecuencia de diferir anillado):** un tomo NO se colapsa
en un `CotizacionItem` compuesto (Tomo-A). Sin paso de anillado compartido no hay
costo común que componer, así que colapsar no aporta nada funcional y agrega el
riesgo del snapshot sintético. v1 = **cada documento es un `CotizacionItem`
estándar** (recotizable), agrupado por `grupoTomoId`. El compuesto Tomo-A se
implementa cuando llegue el anillado (que es lo que realmente lo justifica).

Implementado (en `centro-copiado.service.ts` + controller + dto):
- `agregarAOrden(tenantId, dto, periodo)`: asegura una cotización borrador
  (`cotizacionId` dado y validado, o nueva), y por cada documento llama
  `motor.cotizarYGuardar` (item estándar). Anillado/tomo = N renglones agrupados.
- **Metadata de la carga en `jobContext._centroCopiado`**
  (`grupoCargaId`, `grupoTomoId`, `nombre`, tamaño/color/faz, carillas, hojas):
  persiste en `CotizacionItem.jobContextJson` (verificado: `buildCotizacionItemData`
  guarda el jobContext verbatim, `motor.service.ts:1128`). El alta de la OT la lee
  para agrupar (`specsJson`) y nombrar el renglón por el documento. Sin migración.
- Devuelve `{ cotizacionId, grupoCargaId, items[], totales }`.
- **NO crea la `OrdenTrabajo`**: eso sigue el flujo normal (cotización → OT), que
  ya materializa los pasos vía `materializarPasosItems`
  (`ordenes-trabajo.service.ts:1874`). Los items son estándar ⇒ pasan sin cambios.

**Mejora colateral (producción):** `provisionarPlantillaCentroCopiado` ahora es
**race-safe** (catch de la carrera concurrente → devuelve el existente); importa
porque la provisión lazy del endpoint puede correr en requests simultáneos.

**Verificado** (`__tests__/centro-copiado-agregar.spec.ts`): crea N `CotizacionItem`
en una cotización, cada uno con snapshot+trazabilidad (recotizable), metadata y
`grupoTomoId` persistidos, un solo `grupoCargaId`; y agrega a una cotización
borrador existente sin duplicarla (3 → 6). 9/9 tests centro-copiado verdes en
paralelo (2 corridas), `tsc` limpio.

### Etapa E — Frontend: modal de carga rápida ✅ HECHA (falta verificación visual en vivo)

Implementado:
- `src/lib/centro-copiado-api.ts` — cliente (`opcionesCentroCopiado`,
  `cotizarCentroCopiado`, `construirItemsCentroCopiado`) + mapper
  `itemConstruidoAPropuestaItem` (ItemConstruido → PropuestaItem stageable).
- `src/components/comercial/centro-copiado-sheet.tsx` +
  `centro-copiado-sheet.module.css` — el modal: dropzone (pdf-lib
  `leerMedidasPdf` para contar páginas) + "Simular archivos", valores por
  defecto + "Aplicar a todos", tabla de documentos (tamaño/papel/color/faz/copias
  por fila), selección múltiple → "Anillar juntos" (tomo con juegos), **precio en
  vivo** (debounce 350ms a `/centro-copiado/cotizar`), footer con totales, y
  "Agregar a la OT" (→ `/centro-copiado/construir-items` → `PropuestaItem[]`).
- Integración en `propuesta-ficha.tsx`: botón "Centro de copiado" en
  `.orden-actions`, estado `copiadoOpen`, y `onAgregar` que stagea N renglones
  (mismo patrón que `onAddItem`, en lote).

**Contrato de integración (staging, como el resto de la app):** el modal NO
persiste; produce `PropuestaItem[]` que se stagean en la ficha y se guardan en
bloque en "Guardar cambios" (`persistirSnapshotsItems` cotiza-y-guarda con
`motorCodigo`+`jobContext`, encadenando la misma Cotización). Por eso se agregó
**`POST /centro-copiado/construir-items`** (devuelve por doc el snapshot completo +
especificaciones + jobContext con metadata `_centroCopiado`) y
**`GET /centro-copiado/opciones`** (papeles). El endpoint `agregar-a-orden` (eager,
Etapa D) queda como camino alternativo tested, no lo usa este front.

**Backend nuevo (Etapa E):** `construirItems` + `opciones` en el service/controller;
test `construir-items` en el spec de agregar. 10/10 tests centro-copiado verdes.

**Verificado:** `tsc --noEmit` 0 errores en **frontend y backend**; eslint limpio en
los archivos nuevos; suite backend verde. **PENDIENTE: verificación visual en vivo**
— no la corrí porque (a) bootear el API dev pega a `gdi_saas` con Wati vivo (cron de
despacho manda WhatsApps reales), (b) ya hay otro dev server corriendo, y (c) el
Browser pane aislado no tiene sesión logueada. La app del usuario (API en watch)
debería tomar los endpoints nuevos → se puede clickear el modal ahí.

--- (contrato original, referencia) ---
**Objetivo:** el modal del boceto, conectado a C (preview) y D (guardar).

- Componente `src/components/comercial/centro-copiado-sheet.tsx` **con su propio
  `centro-copiado-sheet.module.css`** (NO globals.css — correr `npm run
  css:guard` antes de cerrar).
- Botón de entrada "Centro de copiado · carga rápida" junto al cotizador
  (`agregar-producto-sheet` / `propuesta-ficha`).
- **Detección de páginas** client-side con pdf-lib (reusar util de la herramienta
  de medidas, Fase 1); páginas editables a mano si el PDF no parsea. Sin subir a
  R2 (D7).
- Estado: defaults heredables ("Aplicar a todos"), overrides por fila (tamaño,
  papel, color, faz, copias), selección múltiple → "anillar juntos" (forma un
  grupo/tomo con juegos y terminación única).
- **Precio en vivo:** llamada debounced (~300 ms) a `POST /centro-copiado/cotizar`
  con todo el estado; pinta subtotal por fila, subtotal del tomo, footer
  (documentos, tomos, carillas, hojas físicas, subtotal + IVA).
- "Agregar a la OT" → `POST /centro-copiado/agregar-a-orden` → refresca la ficha,
  renglones agrupados. Footer del boceto pasa a "Se agregan como N renglones".
- Sin diálogos nativos (usar `ConfirmacionDestructiva`/`ConfirmacionSalida` del
  sistema si hay confirmaciones). Fechas con `src/lib/fecha.ts`.

**Verificación:** journey §5 del diseño en el navegador (preview del dev server).

### Etapa F — Materialización, ruteo y tests ✅ HECHA (salvo visual en vivo)

Tests con **DB aislada** (`gdi_saas_test`), 11/11 verdes en 6 suites:
- `plantilla-cotizacion` — adaptador (pliegos=hojas, papel por hoja no por carilla).
- `pliego-por-cotizacion` — A4 vs A3 (factorA4=2), pliego por-cotización.
- `centro-copiado-preview` — sueltos + tomo, aritmética y totales.
- `centro-copiado-agregar` — N items estándar, metadata, append a borrador,
  `construir-items` (snapshot+especificaciones).
- `centro-copiado-module` — DI wiring.
- `centro-copiado-e2e` — **camino completo**: `construir-items` →
  `cotizarYGuardar` (lo que hace `persistirSnapshotsItems`) → `CotizacionItem`
  con paso `impresion_por_hoja` **materializable** + metadata `_centroCopiado`
  persistida. Prueba que el jobContext del modal sobrevive el guardado y produce
  un item estándar listo para la OT.

Materialización/ruteo: los items son `CotizacionItem` ESTÁNDAR ⇒
`materializarPasosItems` (`ordenes-trabajo.service.ts:1874`) crea los
`OrdenTrabajoItemPaso` sin cambios; Tablero y simulador láser los toman por
`familiaCodigo`/máquina/centro igual que cualquier producto (cubierto por el flujo
existente; el E2E prueba que la trazabilidad está bien formada).

**Verificación visual:** en vivo NO corrida (bootear API = Wati vivo; server ya
corriendo; Browser pane sin sesión). En su lugar se publicó una **maqueta estática
fiel** del modal (mismos tokens/estructura, datos consistentes con el adaptador,
tema claro/oscuro) como Artifact para validar el diseño. Verificación en vivo real:
pendiente de clickear el modal en la app del usuario.

## 2. Trampas conocidas del repo (respetar sí o sí)

- **globals.css:** vista nueva nace con `.module.css`; `npm run css:guard` antes
  de cerrar UI.
- **Integraciones vivas en dev:** `gdi_saas` tiene Wati conectada. NO correr
  services de negocio que disparen WhatsApps contra la dev; tests con DB aislada.
  El TPV es sólo carga/cotización (D9), así que no debería tocar cobros/mensajes.
- **Build API:** no `npm run build` en `apps/api` con el server arriba; usar
  `tsc --noEmit -p tsconfig.build.json`.
- **Nunca ejecutar scripts para "ver si parsean":** `node --check`, jamás
  `require()` (incidente 2026-07-28).
- **Prisma:** no hay migración en v1; si aparece una, nunca aceptar el reset que
  ofrece `prisma migrate dev`.
- **Fechas determinísticas:** `src/lib/fecha.ts`, nunca `toLocaleString` en SSR.

## 3. Deuda / decisiones diferidas

- Recotización del ítem tomo compuesto (sintético) no pasa por el `recotizar`
  estándar; v1 reejecuta el orquestador desde el jobContext guardado. Si molesta →
  Tomo-B (motor multi-segmento nativo).
- Subida real de archivos a R2 (scope `ORDEN_ITEM`), presets, engrapado/
  plastificado, imposición 2-up/booklet, caja/cobro — todo fuera de v1 (§6
  diseño).

## 4. Checklist de arranque

1. [x] Etapa A: provisionador idempotente + verificación motor (spec verde).
2. [x] Etapa B: pliego runtime (hook ya existía) + test A4/A3 verde.
3. [x] Etapa C: módulo `centro-copiado` + adaptador + preview + test (verde).
4. [x] Etapa D: agregar-a-orden (N items estándar, compuesto diferido) + test.
5. [x] Etapa E: modal + pdf-lib + precio en vivo (module css) — falta verificación visual en vivo.
6. [x] Etapa F: tests DB aislada + E2E (11/11) + maqueta visual — falta clic en vivo.
