# Pasos extras inline (G-F3) — análisis funcional/técnico y plan

> Objetivo: dejar **funcionales** los "pasos extras" de un producto — pasos
> puntuales que se insertan en la ruta de **ese producto en particular** sin
> tocar la ruta base reusable ni a los demás productos que la usan. Se
> configuran **desde el editor de pasos** (no desde un panel aparte),
> reusando toda la UI rica existente (activación condicional con rule-builder,
> tiempo/costo, máquina/perfil, slots).

Fecha: 2026-07-06

---

## 1. Estado actual

### Qué existe
- **Modelo `ProductoPasoExtra`** (Prisma) — completo: `familiaCodigo`,
  `insertarDespuesDeRutaPasoId` (null=inicio, UUID=después de ese RutaPaso),
  `ordenInterno`, `modoActivacion`, `condicionActivacionJson`, `modoTiempo`,
  `mecanismoCantidad(+Config)`, `multiplicadoresActivos`, `paramsPasoJson`,
  `maquinaM1Id`, `perfilM1Id`, y JSONs embebidos
  `configSlotsMaterialesJson` / `configMaquinasCandidatasJson` /
  `configCargosDirectosJson`. Scope: `productoId` (NO por ruta alternativa).
- **Backend CRUD** (`cargos-directos-producto.service.ts`): `agregarPasoExtra`
  (persiste todo, calcula `ordenInterno = último+1`, valida FKs cross-tenant) y
  `eliminarPasoExtra`. El DTO acepta `condicionActivacionJson`. **No** persiste
  slots/cargos (no están en el DTO).
- **Panel UI mínimo** (`pasos-extras-panel.tsx`): sólo envía
  `familia + modoActivacion + modoTiempo`. Sin posición, sin regla condicional,
  sin máquina, sin slots, sin edición.
- **API client** (`agregarPasoExtra`): payload **omite** `condicionActivacionJson`.

### Qué NO funciona (hallazgos de la revisión)
1. **El motor ignora los pasos extras por completo.** `cargarProductoYRuta`
   arma `pasos` únicamente desde `rutaAlternativas.configPasos`. Cero
   referencias a `productoPasoExtra` en todo `motor-universal`. → Un paso extra
   **no aparece en la cotización ni afecta costo/tiempo**. Es data muerta.
2. **La regla condicional no se puede configurar** — la UI no renderiza editor,
   y el API client ni siquiera manda `condicionActivacionJson`. Elegir
   "Condicional" guarda `modoActivacion=CONDICIONAL` con condición vacía → no-op.
3. **La posición no es configurable** — la UI nunca manda
   `insertarDespuesDeRutaPasoId`, así que todos quedan en `null` (al inicio),
   que casi nunca es lo deseado.
4. **Sin máquina/perfil** — sin esto un paso no puede costear tiempo/costo.

### Dónde SÍ se usan hoy
- Se leen para mostrarlos en el detalle del producto (UI) y para copiarlos al
  **duplicar** un producto. Nada más.

---

## 2. Framework técnico

### 2.1 Cómo el motor ejecuta un paso
`cargarProductoYRuta` (motor.service.ts) hace un `findFirst` del producto con
`include: rutasAlternativas.configPasos.{rutaPaso, maquinaM1(+perfiles,
consumibles, centroCosto), maquinasCandidatas(...), slotsMateriales(...),
cargosDirectosPaso(...)}`. Luego mapea cada `configPaso` a un **`PasoCargado`**
(shape en `tipos.ts`) y los ordena por `rutaPaso.orden`. El resto del motor
(activación, tiempo, materiales, nesting, precio) opera sobre ese `PasoCargado[]`.

Identificadores usados aguas abajo: `rutaPasoId` (ej. `tecnologia_${rutaPasoId}`),
`configPasoId` (ej. `maquinaSeleccionada_${configPasoId}`, runtime overrides del
cotizador), snapshots, errores, outputs canónicos.

### 2.2 Qué necesita un paso extra para ser ejecutable
Un `ProductoPasoExtra` ya tiene casi todos los campos equivalentes a un
`configPaso`. Para volverlo un `PasoCargado` el motor debe:
- Resolver `maquinaM1` (+ perfiles + consumibles + centro de costo) y
  `perfilM1` — hoy los configPasos los traen por `include`; los extras
  referencian `maquinaM1Id` pero **no hay relación** que los incluya en el query
  del producto (los extras cuelgan de `producto`, no de `rutaAlternativa`).
  → Se necesita **cargar las máquinas de los extras** (query aparte o include).
- Usar **ids sintéticos**: el extra no tiene `rutaPaso` ni `configPaso`.
  Usaremos `pasoExtra.id` como `rutaPasoId` **y** `configPasoId` (strings únicos;
  funcionan para overrides/tecnología/snapshots).
- **Insertarse en la posición correcta** dentro de `pasos`:
  `insertarDespuesDeRutaPasoId` → inmediatamente después de ese `rutaPaso` en el
  array ya ordenado; `null` → al inicio; empates y varios extras en la misma
  posición → por `ordenInterno`. El `rutaPasoOrden` se asigna interpolado
  (ej. orden del paso previo + fracción) sólo para ordenar; no persiste.
- Slots/candidatas/cargos: en v1 se pueden dejar **vacíos** (paso sin material,
  sólo tiempo de máquina/centro de costo). En v2 se hidratan desde los JSON
  embebidos.

### 2.3 Decisión de scope — RESUELTA
El editor es **por ruta alternativa** (`/rutas/[rutaAltId]`). El usuario definió
que el paso extra debe afectar **sólo a la ruta de ese producto en particular**,
nunca a la ruta base ni a otros productos.

→ **Se agrega `rutaAlternativaId` (FK a `ProductoRutaAlternativa`) a
`ProductoPasoExtra`.** El extra pertenece a la ruta alternativa que se está
editando. Ventajas: elimina la ambigüedad de posición (el `insertarDespuesDe`
apunta a un RutaPaso que sí existe en esa ruta), y aísla naturalmente por ruta.

Migración: columna `rutaAlternativaId` **nullable** + backfill (los pocos
registros existentes, si hay, se asignan a la ruta preferida del producto o se
borran por ser stubs) → luego el motor filtra por `rutaAlternativaId`.

> Nota: la ruta base reusable (`Ruta`/`RutaPaso`) **nunca** se toca — los extras
> viven en `ProductoPasoExtra`, que ya es por-producto. El scope por ruta
> alternativa sólo afina a cuál de las rutas del producto aplica.

### 2.4 Piezas reutilizables
- `rule-builder.tsx` — editor de reglas JsonLogic (ya usado en config-pasos).
- `config-pasos-editor-view.tsx` — guarda **paso por paso** (`guardarPaso` →
  `upsertConfigPaso`). Un paso extra sólo rutea su guardado al endpoint
  `pasos-extras`. La lista lateral se arma desde `rutaAlternativa.ruta.pasos`;
  hay que **mergear** los extras.

---

## 3. Casos de uso

1. **Terminación puntual al final** (ej. "instalación eléctrica" sólo en este
   cartel): extra OBLIGATORIO, con máquina/centro de costo, insertado después
   del último paso.
2. **Paso condicional** (ej. "empaque premium" sólo si cantidad > X): extra
   CONDICIONAL con regla JsonLogic, en cualquier posición.
3. **Paso opcional** que el comercial activa al cotizar (ej. "prueba de color").
4. **Paso intermedio** (ej. "laminado especial" entre impresión y refilado):
   posición = después de "Impresión".
5. **Producto con múltiples rutas alternativas**: el extra agregado editando la
   ruta Estándar aparece sólo al cotizar con Estándar, no con las otras.

Fuera de v1 (v2): extra con **slots de material** propios y **cargos directos**
propios.

---

## 4. Journey (UX en el editor)

1. En "Configurar pasos" de una ruta, la lista lateral muestra los pasos de la
   ruta reusable + los extras del producto, en orden real de ejecución. Los
   extras llevan badge **"Extra · solo este producto"**.
2. Entre pasos (y al final/inicio) aparece un affordance **"＋ Insertar paso
   extra"**. Al hacer clic: se elige familia y se crea el extra en esa posición
   (`insertarDespuesDeRutaPasoId` = el paso previo; `null` si va al inicio).
3. El extra se configura con **el mismo panel** que un paso normal: Activación
   (incl. Condicional con rule-builder), Tiempo y costo, Máquina y perfil.
   (Slots/cargos: deshabilitados con nota "próximamente" en v1.)
4. Guardar/borrar del extra → endpoints `pasos-extras` (no `upsertConfigPaso`).
5. El panel viejo "Pasos extras inline" del wizard se retira (o queda como
   resumen read-only que linkea al editor) para no tener dos lugares.

---

## 5. Plan por fases

### Fase 1 — Motor ejecuta los extras (bloqueante, backend puro)
- Migración: `ProductoPasoExtra.rutaAlternativaId` (nullable) + backfill.
- `cargarProductoYRuta`: cargar los `productoPasoExtra` de la ruta alternativa
  resuelta (con sus máquinas/perfiles/consumibles), mapearlos a `PasoCargado`
  (ids sintéticos, slots/cargos vacíos por ahora) e insertarlos en `pasos` según
  `insertarDespuesDeRutaPasoId` + `ordenInterno`.
- Tests del motor: extra obligatorio al final suma su costo/tiempo; condicional
  respeta la regla; opcional respeta el toggle; posición correcta.

### Fase 2 — Backend config completa del extra
- Extender DTO/servicio: `condicionActivacionJson`, `maquinaM1Id/perfilM1Id`,
  `modoTiempo`, `mecanismoCantidad`, `paramsPasoJson`, `insertarDespuesDe`,
  reordenar (`ordenInterno`), y **update** (hoy sólo hay create/delete).
- Endpoint PATCH `pasos-extras/:id`.

### Fase 3 — Editor integra los extras
- Mergear extras en la lista lateral + affordance de inserción + badge.
- Reusar el panel de config (activación/rule-builder, tiempo, máquina/perfil).
- API client: agregar `condicionActivacionJson` y el resto; funciones
  `actualizarPasoExtra`, y guardado ruteado al endpoint correcto.
- Retirar el panel viejo del wizard.

### Fase 4 (futuro) — Slots de material y cargos del extra
- Hidratar `configSlotsMaterialesJson` / `configCargosDirectosJson` y que el
  motor los resuelva como en un configPaso normal.

Orden de ejecución: **1 → 2 → 3**, con 4 diferida. La Fase 1 es la que convierte
el feature de "data muerta" a "afecta la cotización".
