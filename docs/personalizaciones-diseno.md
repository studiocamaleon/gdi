# Productos personalizados — personalizaciones con medida propia

Fecha: 2026-07-13

## Problema

Hoy la medida vive a nivel **producto** (`modoMedidas`, `medidasPredefinidasJson`)
o **job** (`jobContext.piezas[]`, `piezaAreaTotalM2`, `medidaCustomMm`). Todo el
vocabulario de medida es global al producto/job: un producto = un juego de piezas
de un único material base.

Los productos personalizados rompen ese supuesto: una **taza** o una **remera**
son el producto base (medido en "unidad"), pero la **personalización** (la
impresión DTF UV, la estampa) tiene su **propia medida**, que es la que maneja el
costo del material de decoración (film DTF) y del proceso de impresión —
independiente de la medida del producto base.

Escenarios:
- Taza DTF UV con la personalización de **medida predefinida** (transfer estándar).
- Taza DTF UV con la personalización de **medida definida por el cliente**.
- Remera con estampa **frente / espalda / ambas / otra** (N personalizaciones
  opcionales, cada una con su medida).

## Estado actual (mapa)

- `modoMedidas` del producto: FIJA | LIBRE | COMERCIAL_ELIGE | MIXTA
  (schema.prisma). Medidas en `medidasPredefinidasJson` + `medidaDefault*`.
- El sheet arma `jobContext` con datos **globales**: `piezaAreaTotalM2`,
  `medidaCustomMm`, `caras`… (agregar-producto-sheet.tsx `buildJobContext`).
- El motor deriva área/cantidad de esos globales (`calcularM2DesdePiezas`,
  `calcularAreaImpresaConsumiblesM2`, `resolverCantidad`,
  `resolverCantidadProductividadPropia`). Los slots `por_m2` usan el área global.
- Rieles de proceso YA existentes (base): familias `impresion_por_pieza`
  ("tazas, remeras") y `aplicacion_transfer` ("DTF/DTG", marcada "pendiente").
  Cuentan por **unidad**, no por el área de la estampa.

**Hueco:** no existe una "personalización" con medida propia que maneje el costo
de su material/paso, aparte de la medida del producto base.

## Concepto: Personalización (área de decoración)

Un producto puede tener **N personalizaciones**. Cada una, definida por el
modelador:

- `codigo` (estable), `nombre` (Frente, Espalda, "Impresión DTF").
- `modoMedida`: `FIJA` (medida predefinida) | `CLIENTE` (la ingresa el comercial).
- `anchoMm`, `altoMm` (default; para FIJA es la medida, para CLIENTE es el placeholder/sugerencia).
- `obligatoria` (true) u opcional (false → seleccionable en el sheet).
- **A qué paso alimenta**: el paso de impresión del film DTF, cuya área de
  material y tiempo escalan con la medida de esta personalización.

**Costeo preciso:** área de la personalización → film DTF consumido (área ×
cantidad) + tiempo de impresión del film (por área). La **aplicación con plancha**
(`aplicacion_transfer`) sigue por unidad/estampa. Todo separado de la medida del
producto base ("1 unidad"). El precio (margen o fijo) va por encima, como ya está.

## Fase 1 (decidida): Taza DTF UV — 1 personalización, fija + cliente

Config a **nivel producto** (el modelador declara la personalización; el comercial
solo completa la medida al cotizar).

### Modelo de datos (sin migración pesada, estilo `medidasPredefinidasJson`)

- `Producto.personalizacionesJson` (JSON):
  ```
  [{ id, codigo, nombre, modoMedida: 'FIJA'|'CLIENTE',
     anchoMm, altoMm, obligatoria }]
  ```
- Link paso→personalización guardado en `ProductoConfigPaso.paramsPasoJson`
  (evita migración): `paramsPasoJson.fuenteMedida = 'personalizacion:<codigo>'`
  (default sin la clave = 'producto', comportamiento actual → retro-compatible).

### Sheet (cotización)

- Sección "Personalización": si `FIJA` muestra la medida (read-only); si `CLIENTE`
  inputs de ancho × alto. Publica al `jobContext`:
  ```
  ctx.personalizaciones = [{ codigo, anchoMm, altoMm, cantidad, areaM2 }]
  ctx['personalizacion_<codigo>_areaM2'] = areaM2
  ```

### Motor

- El paso con `paramsPasoJson.fuenteMedida = 'personalizacion:<codigo>'` lee su
  área de `ctx['personalizacion_<codigo>_areaM2']` en vez del área global, en:
  - `calcularAreaImpresaConsumiblesM2` (material/film por m²),
  - `resolverCantidadProductividadPropia` (tiempo por área) — nuevo
    `productivityQuantitySource: 'area_personalizacion'`,
  - slots `por_m2` del paso.
- Retro-compatible: sin `fuenteMedida`, todo usa el área global como hoy.

### UI del producto

- Sección/tab "Personalizaciones" (hermana de Medidas): el modelador crea las
  personalizaciones (nombre, fija/cliente, medida) y marca en el paso cuál
  personalización lo alimenta.

## Fases siguientes

- **Fase 2:** N personalizaciones opcionales (remera frente/espalda/ambas),
  selección + medidas en el sheet; posibilidad de material distinto por
  personalización.
- **Fase 3:** configurador 2D en vivo, presets por posición, biblioteca de
  personalizaciones. Relacionado: [[project_constructor_interactivo_productos]],
  [[project_sellos_configurador]] (patrón ruta+slot+editor con medida propia).

## Decisiones tomadas (2026-07-13)

- Fase 1 = taza DTF UV (1 personalización, fija + cliente).
- Configuración a nivel producto.
