# Abstracción de algoritmos de nesting · Diseño técnico

> **Fecha**: 2026-04-23
> **Rama**: `refactor/modelo-universal-v2`
> **Tag base**: `v1.1-stable-pre-modelo-universal`
> **Aprendizaje del refactor anterior**: lo aplicamos acá — análisis primero, extracción NO destructiva, reversible por fases.

> **Actualización 2026-08-19**: la migración al motor universal está completa.
> Los adaptadores legacy `rigid-adapter` y `digital-adapter` fueron retirados
> porque ya no tenían consumidores; el dispatcher universal es la única entrada
> productiva. Este documento conserva las fases originales como historial.

---

## 1. Contexto

En el código actual (17 abr) hay **4 algoritmos de nesting/imposición** repartidos entre motores y métodos privados del `productos-servicios.service.ts`:

| # | Algoritmo | Ubicación |
|---|---|---|
| 1 | Grid 2D placa fija (rigid) | `motors/rigid-printed.calculations.ts:57-113` (single) y `:134-202` (multi-size con MaxRects) |
| 2 | Imposición pliego (digital + reflex) | `productos-servicios.service.ts:12484-12569` (método privado) |
| 3 | Tete-beche + agrupamiento (talonario) | `motors/talonario.calculations.ts:127, 175` (reutiliza #2) |
| 4 | Mixed-shelf rollo + panelizado (gran formato + vinyl) | `productos-servicios.service.ts:15193-15442` y `:16765-16956` (métodos privados) |

**Problemas**:
- 2 de 4 algoritmos son métodos privados del service → no testeables ni reutilizables aislados.
- Cada motor tiene sus propios tipos (`NestingInput/Result`, `ImposicionBase`, `TalonarioImposicionResult`, `GranFormatoCostosPreviewCandidate`) — sin contrato común.
- Helpers geométricos (sustrato→pliego, cortes guillotina, panelizado, instancias de pieza) viven mezclados en el service.
- El nesting puro está mezclado con costeo (rigid mezcla `nestRectangularGrid` con 3 estrategias `m2_exacto | largo_consumido | segmentos_placa`).

**Objetivo**: extraer un módulo `apps/api/src/productos-servicios/nesting/` que sea (a) puro, (b) testeable aislado, (c) con contrato común, (d) usado por TODOS los motores actuales sin cambiar resultados de cotización.

**No-objetivo de esta fase**: cambiar el comportamiento de los motores. Los outputs de `quote*Variant` deben ser **bit-exactos** antes y después.

---

## 2. Aprendizajes del refactor anterior que aplicamos

| Error pasado | Cómo lo evitamos |
|---|---|
| Big-bang: cambiar 5 motores + service + UI a la vez | Extracción **incremental por algoritmo**, motor por motor. |
| Borrar código viejo antes de validar | Mantener el código viejo por 1 PR, **adapter delgado** que delega al nuevo. Borrar después. |
| Sin tests de regresión sólidos | Antes de extraer, **snapshot tests** del output actual de cada `quote*Variant` para 5-10 casos por motor. |
| Tipos divergentes inventados sin mapear lo existente | Diseñar el tipo común **a partir de la unión de los tipos actuales**, no inventando. |
| Sin reversibilidad | Cada PR es un commit chico, revertible aisladamente. Tag `v1.2-pre-nesting-extract` antes de empezar. |

---

## 3. Arquitectura propuesta

### 3.1 Estructura de carpetas

```
apps/api/src/productos-servicios/nesting/
├── types.ts                      # Tipos públicos: Piece, Substrate, Placement, NestingResult
├── algorithms/
│   ├── grid-2d-single.ts         # Algoritmo 1+2 (placa fija + pliego, single-size, rotación)
│   ├── grid-2d-multi.ts          # Variante #1b (multi-size con maxrects-packer)
│   └── shelf-rollo.ts            # Algoritmo 4 (mixed-shelf rollo, multi-size, panelizado)
├── geometry/
│   ├── orientation.ts            # Comparación normal vs rotada 90°
│   ├── margins.ts                # Márgenes de máquina
│   └── separation.ts             # Separación entre piezas
├── helpers/
│   ├── sustrato-to-pliego.ts     # ex: service.ts:12603
│   ├── guillotina-cuts.ts        # ex: service.ts:12641
│   ├── panelizado.ts             # ex: buildGranFormatoPanelizedPieces
│   └── pieces-instances.ts       # ex: buildGranFormatoPieceInstances
├── costing/                      # Decisión 2026-04-23: Opción B (extraer costeo dependiente del nesting)
│   ├── types.ts                  # CostingInput, CostingResult, CostingStrategy
│   ├── strategies/
│   │   ├── m2-exact.ts           # ex: rigid costeoM2Exacto
│   │   ├── consumed-length.ts    # ex: rigid costeoLargoConsumido
│   │   └── plate-segments.ts     # ex: rigid costeoSegmentosPlaca (escalonado)
│   └── index.ts
├── adapters/
│   ├── rigid-adapter.ts          # Mapea Input/Output viejo de rigid ↔ tipo universal (nesting + costing)
│   ├── digital-adapter.ts        # Idem digital
│   ├── talonario-adapter.ts      # Idem talonario (incluye tete-beche y grouping)
│   └── gran-formato-adapter.ts   # Idem gran formato (incluye panelizado)
└── index.ts                      # Barrel export
```

**Por qué `productos-servicios/nesting/` y no `apps/api/src/nesting/`**: hoy todos los consumidores viven en `productos-servicios/`. Si en el futuro otro módulo lo necesita, se mueve un nivel arriba (cambio mecánico). Mantener el primer paso conservador.

### 3.2 Tipos universales (contrato común)

Diseñados como unión de los campos actuales — sin inventar, sin perder ningún campo.

```typescript
// types.ts

/** Una pieza a acomodar. Genérica sobre `T` para llevar metadata del consumidor. */
export interface Piece<T = unknown> {
  /** ID estable para trazabilidad. Lo provee el caller. */
  id: string;
  /** Medidas finales (ya con sangrado/demasía aplicada si corresponde). */
  widthMm: number;
  heightMm: number;
  /** Cantidad de instancias requeridas. */
  quantity: number;
  /** Metadata libre del caller (ej. variante, color, label). */
  meta?: T;
}

/** Sustrato donde se acomodan las piezas. Discriminated union por geometría. */
export type Substrate =
  | { kind: 'sheet'; widthMm: number; heightMm: number; margins?: Margins }    // pliego, placa rígida
  | { kind: 'roll'; widthMm: number; margins?: Margins };                       // rollo (largo variable)

export interface Margins {
  topMm?: number;
  bottomMm?: number;
  leftMm?: number;
  rightMm?: number;
  /** Para rollos: separa esto de top/bottom porque la dirección es distinta. */
  startMm?: number;  // borde de inicio del rollo
  endMm?: number;    // borde de fin del rollo
}

/** Opciones del algoritmo. */
export interface NestingOptions {
  separationHMm?: number;
  separationVMm?: number;
  allowRotation?: boolean;
  /** Para shelf-rollo: panelizar piezas mayores al ancho útil. */
  panelizado?: PanelizadoOptions;
}

export interface PanelizadoOptions {
  enabled: boolean;
  mode: 'automatic' | 'manual';
  axis: 'vertical' | 'horizontal';
  overlapMm: number;
  maxPanelWidthMm: number;
  distribution: 'equilibrada' | 'libre';
  widthInterpretation: 'total' | 'util';
}

/** Posición resultante de una instancia colocada. */
export interface Placement<T = unknown> {
  pieceId: string;
  /** Esquina superior-izquierda en el sustrato. Origen (0,0) = esquina top-left. */
  xMm: number;
  yMm: number;
  /** Medidas finales en el placement. Si rotated=true son las del lado largo en horizontal. */
  widthMm: number;
  heightMm: number;
  rotated: boolean;
  /** Para panelizado: índice del panel y total. */
  panelIndex?: number;
  panelCount?: number;
  panelAxis?: 'vertical' | 'horizontal';
  /** Para piezas con sangrado/demasía: medidas útiles vs totales. */
  usefulWidthMm?: number;
  usefulHeightMm?: number;
  overlapStartMm?: number;
  overlapEndMm?: number;
  /** Metadata heredada de la pieza. */
  meta?: T;
}

/** Resultado de un nesting. */
export interface NestingResult<T = unknown> {
  algorithm: 'grid-2d-single' | 'grid-2d-multi' | 'shelf-rollo';
  /** Sustratos consumidos. Para sheet: cuántos pliegos/placas. Para roll: longitud. */
  substrates: SubstrateUsage[];
  placements: Placement<T>[];
  /** Métricas agregadas. */
  metrics: {
    columnas?: number;     // solo grid
    filas?: number;        // solo grid
    rotada?: boolean;      // solo grid single
    aprovechamientoPct: number;
    areaUtilMm2: number;
    areaTotalMm2: number;
    consumedLengthMm?: number;  // solo rollo
    wasteAreaM2?: number;       // solo rollo
  };
}

export type SubstrateUsage =
  | { kind: 'sheet'; count: number; widthMm: number; heightMm: number }
  | { kind: 'roll'; lengthMm: number; widthMm: number };
```

**Notas de diseño**:
- `Piece<T>` es genérico: el caller decide qué metadata viaja (variante, color, label, sourcePieceId).
- `Substrate` es discriminated union: `sheet` (placa fija o pliego) vs `roll` (rollo de largo variable). Decisión: "placa rígida fija" y "pliego de papel" son geometricamente lo mismo (sheet de medida fija) — diferenciarlos sería falsa especificidad.
- `Placement` admite campos opcionales para panelizado y útiles (cubren los casos de gran formato sin obligar a otros algoritmos a llevarlos).
- Métricas: las comunes son obligatorias; las específicas (columnas/filas, length) son opcionales.

### 3.3 Contrato del costeo (submódulo `costing/`)

Decisión del usuario 2026-04-23: extraer las 3 estrategias actuales de `rigid-printed.calculations.ts` (`m2_exacto`, `largo_consumido`, `segmentos_placa`) al módulo de nesting porque consumen `NestingResult`. Hoy solo rigid las usa, pero quedan disponibles para reutilizar en otros motores en el futuro.

```typescript
// costing/types.ts

export type CostingStrategyKind = 'm2-exact' | 'consumed-length' | 'plate-segments';

export interface CostingInput<T = unknown> {
  /** Resultado del nesting que se va a costear. */
  nesting: NestingResult<T>;
  /** Precio del sustrato por unidad (placa, pliego, etc.). */
  unitPrice: number;
  /** Cantidad total de piezas a producir. */
  totalPieces: number;
  /** Para 'plate-segments': escalones de % ocupación (ej [25, 50, 75, 100]). */
  segmentSteps?: number[];
}

export interface CostingResult {
  strategy: CostingStrategyKind;
  totalCost: number;
  breakdown: {
    unitPrice: number;
    pricePerM2: number;
    fullUnits: number;            // sustratos completos cobrados
    fullUnitsCost: number;
    lastUnit: {                   // último sustrato parcial (si aplica)
      occupationPct: number;
      segmentApplied: number | null;
      cost: number;
    } | null;
  };
}

export type CostingStrategy<T = unknown> = (input: CostingInput<T>) => CostingResult;

export function applyCostingStrategy<T>(
  strategy: CostingStrategyKind,
  input: CostingInput<T>
): CostingResult;
```

**Notas**:
- El input `nesting` ya trae todo lo que las estrategias necesitan (`metrics.columnas/filas`, `metrics.consumedLengthMm`, `placements.length`, etc.) gracias al diseño universal del `NestingResult`.
- Las 3 estrategias quedan disponibles para que otro motor (gran formato, talonario, etc.) las use si corresponde. Hoy nadie más las usa; mañana, si aparece un caso, está listo.
- Si una estrategia futura no encaja en el contrato (ej. costo por segmento no rectangular), se agrega como nueva estrategia sin tocar las existentes.

### 3.4 Contrato de cada algoritmo

```typescript
// algorithms/grid-2d-single.ts
export function nestGrid2DSingle<T>(
  piece: Piece<T>,
  substrate: Extract<Substrate, { kind: 'sheet' }>,
  options?: NestingOptions
): NestingResult<T>;

// algorithms/grid-2d-multi.ts
export function nestGrid2DMulti<T>(
  pieces: Piece<T>[],
  substrate: Extract<Substrate, { kind: 'sheet' }>,
  options?: NestingOptions
): NestingResult<T>;

// algorithms/shelf-rollo.ts
export function nestShelfRollo<T>(
  pieces: Piece<T>[],
  substrate: Extract<Substrate, { kind: 'roll' }>,
  options?: NestingOptions
): NestingResult<T>;
```

Todos puros, todos sync, todos retornan el mismo tipo.

### 3.5 Adaptadores

Cada motor sigue exponiendo su API actual hacia el service. Internamente, el motor llama al nuevo algoritmo a través de un adaptador thin que mapea ida y vuelta. **Cero cambios visibles** desde el service.

Ejemplo:

```typescript
// adapters/rigid-adapter.ts
export function nestRectangularGrid_v2(input: NestingInput): NestingResult {
  const piece: Piece = {
    id: 'pieza',
    widthMm: input.piezaAnchoMm,
    heightMm: input.piezaAltoMm,
    quantity: 1,
  };
  const substrate: Substrate = {
    kind: 'sheet',
    widthMm: input.placaAnchoMm,
    heightMm: input.placaAltoMm,
    margins: { /* ... */ },
  };
  const result = nestGrid2DSingle(piece, substrate, {
    separationHMm: input.separacionHMm,
    separationVMm: input.separacionVMm,
    allowRotation: input.permitirRotacion,
  });
  return mapToLegacyNestingResult(result);  // mismo shape de antes
}
```

Y `motors/rigid-printed.calculations.ts` pasa a:
```typescript
export function nestRectangularGrid(input: NestingInput): NestingResult {
  return nestRectangularGrid_v2(input);   // delega
}
```

El export viejo se mantiene → todos los call-sites siguen funcionando.

---

## 4. Plan de ejecución por fases

### Fase 0 — Safety net (1 hora)

- Tag `v1.2-pre-nesting-extract` apuntando al HEAD actual.
- Snapshot tests: capturar output de `quote*Variant` para 5 casos por motor (los productos seed) y guardarlos como JSON en `apps/api/test/golden/nesting-pre-extract/`.
- Test que compara `quote*Variant` actual contra los goldens.

### Fase 1 — Extracción incremental (1-2 días por algoritmo, total 3-5 días)

Orden propuesto (de más fácil a más complejo):

**1.1 Grid 2D single (rigid + digital)** — los dos comparten geometría base.
- Crear `nesting/types.ts` y `nesting/algorithms/grid-2d-single.ts`.
- Extraer lógica de `motors/rigid-printed.calculations.ts:57-113` y de `service.ts:12484-12569` (la parte de cálculo grid; el manejo de tipos de corte queda en helpers).
- Adaptadores: `rigid-adapter.ts` y `digital-adapter.ts`.
- Modificar `nestRectangularGrid` y `calculateImposicion` para delegar al nuevo.
- Correr golden tests: deben seguir verde.

**1.1.b Costeo de rigid (las 3 estrategias)** — viene junto con 1.1 porque dependen del `NestingResult`.
- Crear `nesting/costing/` con tipos y las 3 estrategias.
- Extraer `costeoM2Exacto`, `costeoLargoConsumido`, `costeoSegmentosPlaca` de `rigid-printed.calculations.ts:257-399`.
- `calcularCosteoMaterial` queda como wrapper thin que delega a `applyCostingStrategy`.
- Tests unitarios de las 3 estrategias (8-12 casos cubriendo edge cases: placa llena, parcial, sin piezas, segmento exacto, etc.).

**1.2 Grid 2D multi (rigid multi-size)** — extraer `nestMultiMedida` (línea 134-202).
- `nesting/algorithms/grid-2d-multi.ts` (usa `maxrects-packer`).
- Adaptador no necesario (no se usa en quotes hoy).
- Tests unitarios con casos directos.

**1.3 Tete-beche y grouping (talonario)** — caso especial de grid 2D + post-procesamiento.
- `nesting/algorithms/grid-2d-single.ts` recibe opción `teteBeche`.
- Helper `tete-beche-postprocess.ts`.
- `nesting/helpers/talonario-grouping.ts` extraído de `motors/talonario.calculations.ts:175`.
- Adaptador `talonario-adapter.ts`.

**1.4 Helpers geométricos extraídos** — antes de mixed-shelf rollo.
- `helpers/sustrato-to-pliego.ts` (de service.ts:12603).
- `helpers/guillotina-cuts.ts` (de service.ts:12641).
- `helpers/pieces-instances.ts` (de buildGranFormatoPieceInstances).
- `helpers/panelizado.ts` (de buildGranFormatoPanelizedPieces).
- Service mantiene wrappers que delegan.

**1.5 Mixed-shelf rollo (gran formato + vinyl)** — el más complejo.
- `nesting/algorithms/shelf-rollo.ts` extraído de service.ts:15193-15442.
- Adaptador `gran-formato-adapter.ts` que mapea `GranFormatoCostosPreviewCandidate` ↔ `NestingResult`.
- `evaluateGranFormatoMixedShelfLayout` y `evaluateGranFormatoImposicionCandidates` quedan como wrappers thin en el service.
- Golden tests deben seguir verde.

### Fase 2 — Migración de consumidores (opcional, sprint posterior)

- Cada motor pasa a usar tipos universales (no los específicos suyos).
- Adaptadores se reducen a casi cero.
- Los tipos viejos quedan como aliases o se eliminan.

### Fase 3 — Limpieza (opcional, sprint posterior)

- Eliminar exports duplicados.
- Mover `productos-servicios/nesting/` a `apps/api/src/nesting/` si emerge un consumidor fuera del módulo.

---

## 5. Tests

### Unitarios (módulo nuevo)

- `grid-2d-single.spec.ts`: 8 casos (single orientation, rotated, no-fit, márgenes asimétricos, separación cero, etc.).
- `grid-2d-multi.spec.ts`: 5 casos (mismo, mixto, no-fit, etc.).
- `shelf-rollo.spec.ts`: 8 casos (1 medida, multi medida, con/sin panelizado, multi-color, etc.).
- `helpers/*.spec.ts`: 1-2 casos por helper.

### Golden / regresión (no rompe motores)

- `quote-regression-pre-nesting-extract.spec.ts`: 5 casos por motor × 5 motores = 25 casos. Compara output JSON contra fixtures capturadas en Fase 0.

### Integración (smoke)

- `quoteRigidPrintedVariant`, `quoteDigitalVariant`, `quoteTalonarioVariant`, `quoteVinylCutVariant` siguen ejecutando sin error y devuelven el mismo total para los productos seed de Corporearte.

---

## 6. Criterios de éxito

1. Los 4 algoritmos viven en `apps/api/src/productos-servicios/nesting/` con contrato común (`Piece`, `Substrate`, `NestingResult`).
2. Los 5 motores cotizan los mismos productos seed con **outputs bit-exactos** vs el commit anterior.
3. Hay tests unitarios del módulo nuevo (>20 tests) y golden tests del comportamiento general.
4. `service.ts` ya no tiene `calculateImposicion` ni `evaluateGranFormatoMixedShelfLayout` ni los helpers — solo wrappers thin que delegan al módulo de nesting.
5. PR/commit por algoritmo (5 commits chicos), no big-bang.

---

## 7. Lo que NO hacemos en esta etapa

- NO cambiamos el modelo de datos (no tocamos `prisma/schema.prisma`).
- NO unificamos motores (cada uno sigue siendo su motor).
- NO introducimos un "SuperMotor" universal — ese fue el error del refactor anterior.
- NO cambiamos shapes de respuesta del endpoint `/cotizar`.
- NO movemos el módulo fuera de `productos-servicios/`.

Cada uno de esos pasos es un proyecto aparte que puede o no ocurrir en el futuro, pero **NO en este refactor de nesting**.

---

## 8. Decisiones que requieren input del usuario antes de arrancar

Ninguna bloqueante. Decisiones técnicas que tomo yo si no se objetan:

- **Ubicación**: `apps/api/src/productos-servicios/nesting/` (no `apps/api/src/nesting/`).
- **Lib de packing multi-size**: reusar `maxrects-packer` (ya instalada).
- **Estilo de tipos**: discriminated unions para `Substrate`, generics `<T>` para metadata libre.
- **Nombres**: `Piece`, `Substrate`, `Placement`, `NestingResult` (en inglés, consistente con TypeScript del codebase).

Si querés cambiar algo de esto, decímelo. Si no, arranco con Fase 0 + Fase 1.1 ahora mismo.
