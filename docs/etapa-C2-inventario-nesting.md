# Etapa C.2.1 — Inventario de los 4 nestings actuales

**Fecha:** 2026-04-18
**Objetivo:** entender exactamente qué hace cada algoritmo de nesting existente antes de extraerlos a `nesting/` como utilities puras compartidas. Este doc es la base para C.2.2 (extracción) y decidir qué va tal cual, qué requiere refactor y qué se queda donde está.

---

## Resumen ejecutivo

4 algoritmos de nesting distintos, en 3 niveles de "pureza":

| Nesting | Estado actual | Dificultad de extracción |
|---|---|---|
| Placa rígida | **Funciones puras ya separadas** en `rigid-printed.calculations.ts` | Baja — cut/paste con renombrar |
| Gran formato rollo | Función privada del service con helpers privados | Media — extraer + sus 3-4 helpers |
| Hoja (imposición 2D) | **Embebido en `quote*Variant`**, sin función separada | Alta — hay que identificar el bloque y refactorizar |
| Plotter/color | **Embebido en `buildVinylCutSimulation`**, mezcla nesting + selección material | Alta — separar nesting de selección |

**Conclusión:** dos de los cuatro ya son extractables con trabajo menor; los otros dos requieren refactor real para separarlos de la lógica de costo/tiempo.

---

## 1. Nesting de **placa rígida** (el más limpio)

### Ubicación
`apps/api/src/productos-servicios/motors/rigid-printed.calculations.ts`

### Funciones ya puras que viven ahí
- `nestRectangularGrid(input) → NestingResult` — grid 2D en placa finita.
- `calculatePlatesNeeded(totalPiezas, piezasPorPlaca) → { placas, sobrantes }`.
- `nestMultiMedida(medidas[], placaAnchoMm, placaAltoMm, ...) → MultiMedidaResult` — usa `MaxRectsPacker` para empaquetar múltiples medidas.
- `calcularCosteoMaterial(input) → CosteoResult` — dispatcher de 3 estrategias.
- `costeoM2Exacto`, `costeoLargoConsumido`, `costeoSegmentosPlaca` (privadas) — estrategias de costeo.

### Input/output de `nestRectangularGrid`
**Input:**
```typescript
{
  piezaAnchoMm: number;
  piezaAltoMm: number;
  placaAnchoMm: number;
  placaAltoMm: number;
  separacionHMm: number;
  separacionVMm: number;
  margenMm: number;
  permitirRotacion: boolean;
}
```
**Output:**
```typescript
{
  piezasPorPlaca: number;
  columnas: number;
  filas: number;
  rotada: boolean;
  posiciones: Array<{ x, y, anchoMm, altoMm, rotada }>;
  aprovechamientoPct: number;
  largoConsumidoMm: number;
  areaUtilMm2: number;
  areaTotalMm2: number;
}
```

### Features
- Rotación automática (prueba las 2 orientaciones y se queda con la que más piezas mete).
- Grid rectangular regular (filas × columnas).
- Márgenes simétricos.
- Multi-medida via `nestMultiMedida` usando `MaxRectsPacker` (bin-packing real).

### Observación crítica — distinción importante
Los "costeos" (`costeoM2Exacto`, `costeoLargoConsumido`, `costeoSegmentosPlaca`) **NO son nesting**. Son estrategias de **pricing** que toman el resultado del nesting + precio del insumo y deciden cuánto cobrar por el material. Deben vivir separadas del nesting.

### Qué extraer a `nesting/nesting-placa-rigida.ts`
- `nestRectangularGrid`
- `calculatePlatesNeeded`
- `nestMultiMedida`
- Tipos: `NestingInput`, `NestingResult`, `MultiMedidaInput`, `MultiMedidaResult`

### Qué se queda en otro lado
Las 3 estrategias de costeo (`costeoM2Exacto` y cía) + `calcularCosteoMaterial` → al refactorizar la familia `impresion_por_pieza`, estas funciones van al runtime del paso o a una utility de pricing. **No son nesting.**

---

## 2. Nesting de **gran formato rollo** (el más sofisticado)

### Ubicación
`apps/api/src/productos-servicios/productos-servicios.service.ts`

### Funciones involucradas (privadas del service)
- `evaluateGranFormatoImposicionCandidates(input)` — **orquestador**: itera materiales + aplica panelizado + ordena por criterio. (~190 LOC)
- `evaluateGranFormatoMixedShelfLayout(input)` — **algoritmo puro** del nesting. (~200 LOC estimado)
- `buildGranFormatoPanelizedPieces(input)` — genera piezas panelizadas (divide pieza grande en N paneles con solape).
- `buildGranFormatoManualPieces(input)` — variante manual (panelizado configurado por el operador).
- `normalizeGranFormatoPanelManualLayout(input)` — normaliza config manual.
- `buildGranFormatoNestingPreview(candidate)` — genera preview gráfico para la UI (SVG coords, etc.).
- `compareGranFormatoPreviewCandidates(a, b, criterio)` — compara candidatos por criterio.
- Helpers de lectura: `readMachinePrintableWidthMmFromRecord`, `readMachineMarginMmFromRecord`, `readMaterialVariantWidthMmFromRecord`.

### Input/output de `evaluateGranFormatoMixedShelfLayout`
**Input:**
```typescript
{
  printableWidthMm: number;
  marginLeftMm, marginStartMm, marginEndMm: number;
  separacionHorizontalMm, separacionVerticalMm: number;
  permitirRotacion: boolean;
  medidas: Array<{ anchoMm, altoMm, cantidad }>;
  panelizado?: {
    activo, mode ('automatico'|'manual'), axis ('vertical'|'horizontal'),
    overlapMm, maxPanelWidthMm,
    distribution ('equilibrada'|'libre'),
    widthInterpretation ('total'|'util'),
    manualLayout
  };
}
```
**Output:**
```typescript
{
  orientacion, piecesPerRow, rows, consumedLengthMm, usefulAreaM2,
  panelAxis, panelCount, panelOverlapMm, panelMaxWidthMm,
  panelDistribution, panelWidthInterpretation, panelMode,
  placements
}
```

### Features
- Ancho útil derivado del **mínimo entre ancho de rollo y ancho imprimible de la máquina**.
- 4 márgenes no-imprimibles de la máquina (izq/der/inicio/fin).
- Rotación automática.
- **Panelizado** (dividir piezas grandes en sub-paneles con solape) en 2 modos:
  - Automático: el sistema calcula cómo dividir.
  - Manual: el operador configura el layout.
- Panelizado con distribución equilibrada o libre, interpretación del ancho máximo como total o útil.
- Múltiples candidatos (normales + panelizados) ordenados por criterio (`menor_costo_total`, `menor_largo_consumido`, `mayor_aprovechamiento`, etc.).

### Qué extraer a `nesting/nesting-rollo.ts`
- `evaluateGranFormatoMixedShelfLayout` → renombrar a `nestOnRoll` (nombre consistente con la capa de nesting).
- `buildGranFormatoPanelizedPieces` → helper interno de `nestOnRoll`.
- `buildGranFormatoManualPieces` → helper interno.
- `normalizeGranFormatoPanelManualLayout` → helper interno.
- Tipos: Input, PanelizadoConfig, Output, etc.

### Qué se queda en otro lado (orquestación, no nesting)
- `evaluateGranFormatoImposicionCandidates` (itera materiales) → esto es **selección de material**, no nesting puro. Va al motor v2 o a una regla de selección.
- `compareGranFormatoPreviewCandidates` → ídem, es lógica de comparación/decisión.
- `buildGranFormatoNestingPreview` → es generación de preview para UI, va en otro lugar.
- Helpers `readMachinePrintableWidthMm...` → extracción de atributos, pueden quedar en el motor o en un helper de "resolución de máquina".

### Punto delicado
El nesting de rollo es el único que **recibe info de máquina** (ancho imprimible, márgenes). Hoy eso se lee del objeto máquina directo. Al extraer, el nesting debe recibir esa info como input ya resuelto — no puede leer DB. El orquestador del motor v2 se encarga de cargar la máquina y pasarle los valores al nesting.

---

## 3. Nesting de **hoja / imposición 2D** (embebido en quote*Variant)

### Ubicación
No hay función extractada. La lógica vive mezclada dentro de:
- `quoteDigitalVariant` en `productos-servicios.service.ts` (~línea 5958)
- `quoteTalonarioVariant` (~línea 1821)
- Usa `nestRectangularGrid` de `rigid-printed.calculations.ts` como paso interno.

### Qué hace la lógica
1. Toma las medidas de pieza (variante).
2. Toma los pliegos canónicos soportados (`CANONICAL_PLIEGOS_MM`: A4, A3, SRA3, SRA3+, SRA3++, 22x34, Carta, Oficio, A5, A6).
3. Itera pliegos candidatos.
4. Por cada pliego, calcula:
   - `piezasPorPliego` via `nestRectangularGrid(piezaAncho, piezaAlto, pliegoAncho, pliegoAlto, ...)`.
   - `pliegosNecesarios = ceil(cantidad / piezasPorPliego)`.
   - Costo estimado del pliego (papel, toner, tiempo).
5. Elige el pliego óptimo (menor costo o mayor aprovechamiento).
6. Calcula merma por tipo de papel, conversión g/m² → peso total, etc.

### Mezcla de responsabilidades
- **Nesting puro** (`nestRectangularGrid` con variaciones de pliego) → se puede extraer.
- **Selección de pliego** (qué formato A3/SRA3 usar) → es una regla de selección / decisión.
- **Cálculo de merma** → es pricing, no nesting.
- **Conversión de unidades** → helper separado.

### Qué extraer a `nesting/nesting-hoja.ts`
Una función de más alto nivel que la pura de placa rígida:
```typescript
nestOnSheet(input: {
  piezas: Medida[];
  candidatosPliego: Array<{ anchoMm, altoMm, codigo }>;
  separacion, margen, permitirRotacion;
  criterio: 'menor_desperdicio' | 'menor_pliegos' | 'mayor_aprovechamiento';
}) → {
  pliegoElegido: { codigo, anchoMm, altoMm };
  piezasPorPliego: number;
  pliegosNecesarios: number;
  aprovechamientoPct: number;
  alternativas: Array<...>; // para trazabilidad
}
```

Internamente usa `nestRectangularGrid` (de nesting-placa-rigida) iterando sobre los candidatos. La diferencia con placa rígida es que aquí hay **selección de formato de pliego**.

### Qué se queda en otro lado
- Merma por tipo de papel → familia `impresion_por_hoja` en su cálculo de material.
- Conversión g/m² → helper genérico.
- Validaciones de compatibilidad papel/máquina → regla de selección.

---

## 4. Nesting de **plotter/color** (embebido en buildVinylCutSimulation)

### Ubicación
`buildVinylCutSimulation` en `productos-servicios.service.ts` (~línea 16196).

### Qué hace
1. Toma el payload con colores, cada color con sus medidas.
2. Itera **combinaciones de material + plotter** compatibles según la config.
3. Para cada combinación:
   - Separa piezas por color (cada color usa un sub-rollo).
   - Para cada color, calcula nesting en el ancho del plotter/material.
   - Suma largo consumido por color → área total consumida.
4. Calcula costo total por combinación (material + plotter).
5. Elige la combinación ganadora por `criterioSeleccionMaterial` (menor costo total / menor largo consumido).

### Mezcla de responsabilidades
- **Nesting puro** (piezas en rollo dado un ancho) → ya lo cubre `nesting-rollo` (con panelizado opcional). Vinyl cut no usa panelizado pero puede usar la misma función.
- **Selección de combinación** (material+plotter por criterio) → regla de selección.
- **Agrupamiento por color** → orquestación específica de vinyl cut.
- **Cálculo de costo** → pricing.

### Qué extraer a `nesting/nesting-plotter-color.ts`
En realidad, el nesting "por color" es el mismo nesting de rollo aplicado N veces (una por color). No necesita un algoritmo distinto.

**Propuesta:** no creamos un "nesting-plotter-color" como algoritmo separado. En su lugar:
- La familia `corte` con subtipo plotter usa `nesting-rollo` (el mismo que gran formato).
- La **agrupación por color + selección material/plotter** se modela como **Regla de Selección** + orquestación en el motor vinyl_cut v2.

### Qué se queda en otro lado
- Iteración material+plotter → **Regla de Selección** (dominio: `centroCosto` + `MATERIAL`).
- Agrupación por color → helper del motor vinyl_cut v2.
- Selección ganadora → regla.

---

## 5. Matriz de extracción

| Nesting | Archivo destino | Funciones extraídas | Helpers |
|---|---|---|---|
| Placa rígida | `nesting/nesting-placa-rigida.ts` | `nestRectangularGrid`, `nestMultiMedida`, `calculatePlatesNeeded` | Tipos + interno `calcGrid` |
| Rollo (gran formato + vinyl cut) | `nesting/nesting-rollo.ts` | `nestOnRoll` (renombre de `evaluateGranFormatoMixedShelfLayout`) | `buildPanelizedPieces`, `buildManualPieces`, `normalizeManualLayout` |
| Hoja | `nesting/nesting-hoja.ts` | `nestOnSheet` (nueva, envuelve `nestRectangularGrid` iterando pliegos) | Catálogo de pliegos `CANONICAL_PLIEGOS_MM` |
| Plotter/color | ~~`nesting-plotter-color`~~ **NO se crea** | — | Reutiliza `nesting-rollo`; orquestación vive en motor vinyl_cut v2 + reglas |

**Resultado:** 3 archivos de nesting puro, no 4. El "nesting de plotter/color" era en realidad `nesting-rollo` aplicado N veces con lógica de selección alrededor.

---

## 6. Qué se queda en **otro lado** (no va a `nesting/`)

Durante la extracción, hay código que parece "relacionado con nesting" pero conceptualmente no lo es. Va a otros lugares:

| Función | Destino |
|---|---|
| `costeoM2Exacto`, `costeoLargoConsumido`, `costeoSegmentosPlaca`, `calcularCosteoMaterial` | **Pricing** — familia `impresion_por_pieza` en runtime del paso. No son nesting. |
| `evaluateGranFormatoImposicionCandidates` (orquestador que itera materiales) | **Motor v2** de gran formato + **Regla de Selección** (dominio `MATERIAL`). |
| `compareGranFormatoPreviewCandidates` | **Regla de Selección** — lógica de orden por criterio. |
| `buildGranFormatoNestingPreview` | UI/service — **transformación UI-específica** (placements → props React/SVG). Los placements base salen del nesting. |
| `readMachinePrintableWidthMm*`, `readMachineMarginMm*`, `readMaterialVariantWidthMm*` | **Helpers de resolución de data** en el service (o en una utility `resources/` separada). |
| `CANONICAL_PLIEGOS_MM` | **Catálogo estático** — puede quedar en `nesting/nesting-hoja.ts` como constante exportada, o en una config separada. |
| Lógica de selección material+plotter de vinyl cut | **Regla de Selección** (multi-dominio: MATERIAL + CENTRO_COSTO) + orquestación del motor vinyl_cut v2. |
| Cálculo de merma por tipo de papel | Runtime de familia `impresion_por_hoja`. |

---

## 7. Decisiones técnicas consolidadas (lo que voy a aplicar al codear)

| # | Decisión | Razón |
|---|---|---|
| D1 | Firma fuerte TypeScript por cada nesting (tipos Input/Output explícitos) | Autocompletado, detección temprana |
| D2 | Tres modos por familia: `produce` / `consume` / `none` | Los pasos encadenados comparten layout, se calcula 1 vez |
| D3 | Config del nesting en `ProcesoOperacion.configNestingV2: Json?` (agregado a A.3) | Cada paso de cada producto puede tener su config propia |
| D4 | Nestings **puros** — sin I/O, sin DB | Testeabilidad, performance, simplicidad |
| D5 | Regla de Selección elige material antes, nesting corre sobre el ganador | Separación de responsabilidades |
| D6 | Pasos `consume` leen `produce` anterior via outputs canónicos del contrato de paso | Modelo universal lo soporta (leeDePasos) |
| D7 | Validación de capacidades min() en upsert del producto, no al cotizar | Falla rápida al configurar, no al cotizar |
| D8 | 3 archivos de nesting (no 4): plotter/color se resuelve con `nesting-rollo` + reglas | Menos duplicación |
| D9 | **Cada nesting devuelve `placements`** en su output (posiciones x/y, rotaciones, paneles) | UI puede dibujar preview gráfico sin tocar el nesting; la adaptación UI-específica vive en otro lado |

---

## 8. Plan de extracción (orden sugerido)

Con el inventario claro, la extracción se puede hacer en pasos pequeños seguros:

| # | Qué | Esfuerzo | Riesgo |
|---|---|---|---|
| 1 | Crear `nesting/README.md` con el contrato general | 30 min | Nulo |
| 2 | **Extraer `nesting-placa-rigida.ts`** (cut/paste de `rigid-printed.calculations.ts`). Dejar en ese archivo un re-export para compat. | 2-3 h | Bajo — ya es función pura |
| 3 | **Extraer `nesting-rollo.ts`** (mover `evaluateGranFormatoMixedShelfLayout` + helpers). Service queda con los orquestadores que ahora llaman al nesting extraído. | 1-2 días | Medio — son privados del service, hay que romper encapsulación |
| 4 | **Crear `nesting-hoja.ts`** con `nestOnSheet` (nueva función que itera pliegos). Los `quote*Variant` v1 pueden seguir con su lógica actual por ahora. | 1 día | Bajo — es código nuevo, no rompe existente |
| 5 | Tests de cada nesting extraído (copiar o escribir desde cero, contra los goldens actuales) | 1-2 días | Bajo |
| 6 | Agregar campo `modoNesting` + `nestingAlgoritmo` a `pasos/familias.ts` | 2 h | Nulo — aditivo |
| 7 | Migración Prisma: campo `configNestingV2` en `ProcesoOperacion` | 1 h | Nulo — aditivo |
| 8 | Refactor `wide-format-v2.motor.ts` para usar `nesting-rollo` real (elimina `wide-format-v2.calculations.ts`) | 1 día | Bajo — tests actuales validan |

**Total: 5-7 días de trabajo concentrado.**

Después de esto, los motores v2 (vinyl_cut, digital, rigidos, talonario) consumen los nestings centralizados. Cada motor v2 queda chico y declarativo.

---

## 9. Qué falta decidir (decisiones abiertas menores)

- **Nombres de los archivos**: ¿`nesting-placa-rigida` o `nesting-placa`? ¿`nesting-hoja` o `nesting-pliego`? (decisión estética, sin impacto técnico)
- **Catálogo de pliegos** (`CANONICAL_PLIEGOS_MM`): ¿vive en `nesting-hoja.ts` o en un archivo `catalog/` separado? (recomendación: en `nesting-hoja.ts`, salvo que se use desde otros lugares)
- **Naming de tipos**: ¿`NestingResult` genérico o `NestingPlacaResult`, `NestingRolloResult`? (recomendación: específicos para evitar confusión)

Estas decisiones son cosméticas y se pueden resolver al codear.

---

## 10. Próximo paso

Con este inventario, puedo ir directo a **C.2.2 (extracción)**. El paso 2 (nesting-placa-rigida) es trivial; lo hago primero como prueba del patrón. Si sale limpio, sigo con rollo y hoja.

**Espera tu OK para arrancar la extracción.**
