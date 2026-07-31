# Estaciones por reglas — handoff para retomar (Fase C + cableado)

> Para arrancar en una sesión nueva. Rama `feat/estaciones-reglas` (desde `dev`).
> Diseño: `docs/estaciones-reglas-diseno.md`. Fecha del handoff: 2026-07-31.

## 1. Qué ya está hecho (no rehacer)

| Fase | Commit | Qué |
|---|---|---|
| A — persistir máquina en el paso | `33e93864` | `OrdenTrabajoItemPaso.maquinaId` (migración 20260731150000). Motor setea `tiempo.maquinaId`; materialización lo guarda. Test verde. |
| B — modelo de reglas + derivación | `c56f4f86` | `EstacionRegla` (migración 20260731160000). Nueva `resolverEstacionDePaso` por prioridad (front + copia ETA). 12 tests. |
| C — backend CRUD de reglas | `74b5ca22` | Upsert de estación acepta/persiste/devuelve `reglas` (tipo tecnología/paso). Tipos front. |
| C — cableado + UI + saca selector | (sin commitear) | **Todo lo de abajo (§4.1/4.2/4.3) HECHO.** Ver "Qué se hizo en esta sesión". |

**Estado tras esta sesión: ACTIVO.** El paso ya trae `maquinaId` + `tecnologia`
derivada (tablero + ETA), el panel de estación arma reglas por tecnología/paso/
familia/máquina, y el editor de pasos del tenant ya no asigna estación. La
derivación por reglas está en uso; el fallback legacy sólo cubre órdenes viejas
sin `maquinaId` y estaciones sin reglas nuevas.

## Qué se hizo en esta sesión (Fase C completa)

- **4.1 Cableado de lectura.** Helper puro `apps/api/src/common/tecnologia-maquina.ts`
  (espejo backend de `getMachineTechnology`, 6 tests). El paso del tablero
  (`ordenes-trabajo.service.ts`, `toTableroItem` + `tecnologiaPorMaquinaDeItems`,
  3 call sites) y del ETA (`eta.service.ts`, `assembleItems` + `tecnologiaPorMaquina`)
  ahora traen `maquinaId` + `tecnologia` (derivada en lectura, una query por lote).
  Tipo `Estacion` del motor ETA extendido con `maquinas[].id` + `reglas`
  (`findEstaciones` ya los devolvía).
- **4.2 Panel de estación.** `estaciones-panel.tsx` sección 02 ahora "Reglas de
  captura": por tecnología (catálogo `tecnologiaMaquinaItems`), por familia (lo de
  antes), por paso concreto (regla `paso`), + máquina en Recursos (sección 03).
  Reusa clases globales existentes (css:guard OK, sin globales nuevas). Validación
  de consistencia nueva en `produccion.service.ts` (`validarReferencias`): una
  tecnología/paso lo captura a lo sumo una estación.
- **4.3 Selector fuera del editor de pasos.** `pasos-familias-view.tsx`: step
  "estacion" → "centro" (sólo centro de costo), quitado el campo/estado
  `estacionId`, la columna "Estación" y la carga de `getEstaciones`.
  `familias-tenant.service.ts` + DTO: dejó de escribir `EstacionFamilia` desde
  `input.estacionId` (campo eliminado). Test de integración actualizado.

Verificado: `tsc` front + `tsc -p tsconfig.build.json` API limpios · `css:guard`
sin globales nuevas · vitest derivación 12/12 · jest eta 37/37, produccion+
familias-tenant 65/65, tecnologia-maquina 6/6 · motor-universal idéntico al
baseline (17 fallos preexistentes, sin regresión). **Sin verificación visual del
panel** (bar del handoff §5 = checks automáticos). **Falta commitear.**

**Estado histórico (pre-sesión): NEUTRAL.** La derivación nueva caía al fallback
legacy mientras los pasos no trajeran `maquinaId` y no hubiera reglas cargadas.
Todo aditivo. Migraciones aplicadas a dev **y** test.

## 2. Decisiones ya tomadas

1. `EstacionRegla` es tabla nueva (no se extendió `EstacionFamilia`).
2. La **tecnología del paso se DERIVA** de `maquinaId` (lookup `Maquina.tecnologia`),
   no se persiste aparte.
3. Habrá regla catch-all — pendiente de decidir su forma en la UI.
4. Órdenes viejas sin `maquinaId`: **fallback al centro de costo** (ya está en la
   derivación, paso 4).
5. Reparto de responsabilidades de las reglas:
   - **familia** → `EstacionFamilia` (existente).
   - **máquina** → `Maquina.estacionId` (existente, asignación de máquinas).
   - **tecnología / paso** → `EstacionRegla` (nuevo).

## 3. La derivación (ya reescrita, entender antes de cablear)

`resolverEstacionDePaso(estaciones, paso)` — dos copias idénticas:
- Front: `src/lib/tablero-produccion.ts` (~línea 378).
- Back: `apps/api/src/eta/motor/tablero-tipos.ts` (~línea 110).

Prioridad: **1) máquina** (`paso.maquinaId` está en `estacion.maquinas[].id`) →
**2) tecnología** (regla) → **3) paso concreto** (regla, `valor === familiaCodigo`)
→ **4) fallback legacy** familia + centro (intacto). Tests:
`src/lib/tablero-produccion.test.ts` (12, cubren neutralidad + ruteo + prioridad).

**Contratos que la derivación espera** (hoy no se los pasan → por eso es neutral):
- `estacion.maquinas: [{ id?, centroCostoId }]` — falta poblar `id`.
- `estacion.reglas?: [{ tipo, valor }]` — falta poblar.
- `paso.maquinaId?` y `paso.tecnologia?` — faltan poblar.

## 4. Lo que falta (Fase C) — 3 piezas

### 4.1. Cableado de la lectura (ACTIVA el ruteo) — hacer PRIMERO

Sin esto, todo lo nuevo es inerte. Hay que poblar los 3 contratos de arriba.

**a) El paso lleva `maquinaId` + `tecnologia`:**
- `OrdenTrabajoItemPaso.maquinaId` YA se persiste. Falta seleccionarlo y mapearlo
  en las lecturas del tablero/ETA:
  - `apps/api/src/ordenes-trabajo/ordenes-trabajo.service.ts`: el tipo del paso
    (~2909), el `select` (~3247) y el mapeo a `TableroPasoData` (~2974). Agregar
    `maquinaId` y `tecnologia`.
  - `apps/api/src/eta/eta.service.ts`: `select` (~98-99) y mapeo (~126).
- **`tecnologia` se deriva** de `maquinaId` (decisión #2). `OrdenTrabajoItemPaso
  .maquinaId` es String sin FK → hacer un lookup: juntar los `maquinaId` del lote
  y traer `Maquina.tecnologia` (usar `resolverTecnologiaMaquina` del motor como
  referencia, o `Maquina.parametrosTecnicosJson.tecnologia` / plantilla).

**b) La estación lleva `reglas` + `maquinas[].id`:**
- Front: `getEstaciones()` ya devuelve `reglas` (backend commit `74b5ca22`). El
  tablero (`src/components/produccion/tablero-produccion.tsx`, callers de
  `resolverEstacionDePaso` en ~310, ~1288, ~1305) pasa `estaciones`; verificar que
  el shape incluya `reglas` y `maquinas[].id` (el `EstacionMaquinaRef` ya tiene
  `id`).
- Back (ETA): `apps/api/src/eta/motor/flujo-produccion.ts` (~335) y su carga de
  estaciones: incluir `reglas` (select `tipo, valor`) y `maquina.id`.

**c) Verificar neutralidad:** con datos actuales (sin reglas, pasos nuevos con
maquinaId) el ruteo por máquina puede cambiar respecto del centro. Es el arreglo
buscado (caso 2-digitales-mismo-centro), pero confirmar contra un tablero real que
las máquinas estén asignadas a sus estaciones (`Maquina.estacionId`).

### 4.2. Panel de estación: reemplazar la sección grande de familias por reglas

- Componente: `src/components/produccion/estaciones-panel.tsx`.
  - Sección grande hoy: "Familias de pasos" (`est-section-head` ~667), checkboxes
    por categoría (`familiasPorCategoria` ~592, `getFamiliasPasos`), `toggleLista`
    (~576), `draft.familias` (~569).
  - Reemplazar por una sección **"Reglas de captura"** compacta: agregar/quitar
    reglas de 4 tipos —**familia** (`draft.familias`), **tecnología** (`reglas`,
    catálogo de tecnologías), **paso concreto** (`reglas`, catálogo de familias/
    pasos), **máquina** (`draft.maquinaIds`, ya en "Recursos")—. Enviar
    `reglas: [{tipo,valor}]` en el `EstacionPayload` (campo ya existe).
  - Catálogo de tecnologías: NO hay endpoint aún → **crear** (`GET` de las
    tecnologías del tenant, desde las `Maquina.tecnologia` distintas o un catálogo
    fijo). Catálogo de familias: `getFamiliasPasos()` ya existe.
- La regla de consistencia "una general por familia" (validación actual del upsert
  ~1062) sigue viva para las reglas familia.

### 4.3. Sacar el selector de estación del editor de pasos del tenant

- Front: `src/components/productos-servicios/pasos-familias-view.tsx` — campo
  `estacionId` (~116, 182, 257, 304, 361, 419), step "estacion" (~73), carga
  `getEstaciones()` (~464). Quitar el paso/campo de estación del wizard.
- Back: `apps/api/src/productos-servicios/familias-tenant.service.ts` — hoy
  `input.estacionId` escribe/pisa una fila en `EstacionFamilia` (replace
  destructivo). Al sacar el selector, dejar de escribir desde acá; el ruteo se
  arma sólo desde el panel de estación.

## 5. Cómo verificar

- `npx tsc --noEmit` (front) y `npx tsc --noEmit -p tsconfig.build.json` (apps/api).
- `npm run css:guard` antes de cerrar UI.
- Tests: `npx vitest run src/lib/tablero-produccion.test.ts` (derivación).
  `cd apps/api && npx jest motor-universal` (baseline 17 + el test de Fase A).
- Migraciones nuevas: `prisma migrate deploy` (nunca `migrate dev` — resetea),
  aplicar a dev **y** test (ver comando en los commits previos).

## 6. Fase D (después, no ahora)

Retirar el ruteo por centro de costo del fallback y migrar `EstacionFamilia` →
`EstacionRegla` tipo familia, una vez que el cableado esté verificado en uso.
