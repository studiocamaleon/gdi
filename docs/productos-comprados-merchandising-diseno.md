# Productos comprados / merchandising personalizable — diseño

> Estado: **análisis + diseño** (2026-07-13). No ejecutado. Complementa
> `docs/personalizaciones-diseno.md` (la decoración) con **el otro lado**: el
> artículo base comprado (el "blank").

## 1. El problema

El modelo de producto actual asume que el producto se **fabrica** a partir de
materia prima, y que su **medida** es la variable de costeo (más grande = más
material + tinta + tiempo). Eso vale para banners, vinilos, impresos.

No vale para el merchandising que **comprás y revendés** decorado:

- Una remera talle S y una XL **cuestan lo mismo** (se compran por unidad).
- Una taza cuesta lo que se pagó, sin importar "cuánto mide".
- La **medida global del producto no cumple ninguna función de costeo**.

Para estos productos el precio sale de **dos fuentes independientes**:

1. **El artículo base (blank)** → costo **fijo por unidad** = precio de compra.
   Talle/color = variantes (normalmente al mismo precio).
2. **La decoración (personalización)** → costo por **área de la estampa**
   (DTF/sublimación). Ya diseñado e implementado (ver
   `personalizaciones-diseno.md`).

La "medida del producto" para una taza pasa a ser **"por unidad", sin medida
global**.

## 2. Estado actual del sistema (verificado)

### Lo que YA funciona (motor)

- **Costeo de blank por unidad**: slot `sustrato` de un paso con fórmula
  **`por_pieza`** → `cantidad × precioReferencia`, sin área.
  (`motor.service.ts:3040-3041`; despacho de fórmulas `:3011-3091`). `fijo` da
  un monto por orden (no por unidad); `por_unidad_productiva` sobre un paso
  DIRECT también colapsa a `qty × precio`.
- **Familias de proceso por unidad ya existentes**:
  - `impresion_por_pieza` (`familias.ts:430-477`) — productos típicos declarados:
    "Tazas personalizadas", "Remeras DTG". Slot `sustrato_principal`
    (`MP.sustratoPieza`). Requiere máquina (M-1/M-2) + tinta.
  - `aplicacion_transfer` (`familias.ts:479-520`) — "Remeras estampadas". Slots
    `textil` (SUSTRATO) + `film_transfer`. Requiere plancha + film.
  - `trabajo_manual` (`familias.ts:1427-1473`) — M-0 (sin máquina), slot
    opcional `insumo_manual`. Único camino sin máquina hoy (para un blank
    **sin** decorar, aunque es semánticamente incómodo).
- **La medida es opcional para productos por unidad**: `unidadComercial="unidad"`
  (default, `schema.prisma:1422`); la cantidad fluye por `jobContext.cantidad` →
  `resolverCantidad` DIRECT (`motor.service.ts:4435-4437`). Un paso con solo
  slots `por_pieza`/`fijo` nunca lee medida.

### Lo que la biblioteca YA puede guardar

- Un blank = `MateriaPrima` (base) + `MateriaPrimaVariante` (variante) con
  `unidadStock/Compra=UNIDAD`, `precioReferencia Decimal(14,6)` (el precio por
  unidad ya vive acá, `schema.prisma:1080`), `moneda`, `proveedorReferenciaId`.
- Variantes talle/color = `atributosVarianteJson` (libre), igual que hoy
  `PVC_ESPUMADO` lleva `espesor`/`color` en 8 variantes
  (`material-presets.js:8-46`).

### Los huecos (todos en biblioteca / UX, NO en el motor)

1. **Sin familia/subfamilia para indumentaria ni reventa.**
   `FamiliaMateriaPrima` (16 valores, `schema.prisma:254-271`) son insumos de
   impresión/cartelería. La única cercana es la subfamilia
   `OBJETO_PROMOCIONAL_BASE` (`:277`), que está **bajo `SUSTRATO`** (tazas,
   botellas) y **tiene cero presets**. Los textiles no tienen hogar
   (`PERFIL_BASTIDOR_TEXTIL` son perfiles de aluminio SEG, no prendas).
2. **Sin template → no creable por la UI.** El alta es template-driven
   (`materias-primas-panel.tsx:142-195`); no hay template de objeto promocional
   ni de textil en `materia-prima-templates.ts` (37 templates `*_v1`).
3. **Sin concepto de "producto comprado / reventa".** Todo es "materia prima".
   Hay `esConsumible`/`esRepuesto` pero ningún flag de "artículo terminado
   comprado". No hay presets de merchandising.
4. **Precio por variante, no por base.** El "mismo precio para todos los talles"
   se repite en cada `MateriaPrimaVariante.precioReferencia` (30 filas para 5
   colores × 6 talles).
5. **Familias per-unit exigen máquina + consumible.** `impresion_por_pieza` /
   `aplicacion_transfer` no permiten M-0: no modelan un blank **sin** decorar
   vendido tal cual.

## 3. El modelo correcto

Un **producto personalizable comprado** =
**BLANK (comprado por unidad) + 1..N DECORACIONES (personalizaciones con área)**.

- **BLANK** → materia prima por unidad, en el slot sustrato del paso, `por_pieza`.
  Aporta el costo base. Variantes talle/color al mismo (o distinto) precio.
- **DECORACIÓN** → una o más personalizaciones (ya implementadas); cada una tiene
  su medida propia que maneja el costo del film/tinta + el tiempo del paso.
- **MEDIDA GLOBAL** → no aplica. `unidadComercial="unidad"`, sin medida
  predefinida. La UI del producto debería **ocultar** la sección de medida para
  este tipo.

## 4. Taxonomía de tipos de producto (lista completa)

### 4.1 Ejes

- **Eje 1 — Artículo base (blank):** qué objeto físico es (lo que se compra).
- **Eje 2 — Técnica de decoración:** qué proceso lo personaliza (la
  personalización / paso). Un blank puede admitir varias técnicas.

### 4.2 Blanks — Textiles / indumentaria

Variantes típicas: **talle** (XS–XXXL) × **color**, normalmente **mismo precio**
por talle (a veces recargo en talles grandes).

- Remera algodón (manga corta / manga larga)
- Remera poliéster / deportiva (dry-fit)
- Musculosa
- Chomba / piqué
- Buzo canguro (hoodie) / buzo cuello redondo
- Campera rompeviento
- Gorra (trucker, gabardina) / piluso (bucket)
- Tote bag / bolsa de tela / ecobag
- Delantal
- Toalla / toallón

### 4.3 Blanks — Merchandising rígido / objetos

Variantes típicas: **color** / **modelo** / **capacidad**; precio por variante.

- Taza cerámica blanca / taza mágica / jarro enlozado
- Botella / squeeze / termo / vaso térmico
- Vaso plástico / acrílico
- Mouse pad / mousepad XL
- Llavero (acrílico, metal, madera)
- Lapicera / bolígrafo
- Cuaderno / libreta / agenda / anotador
- Imán de heladera / pin / prendedor
- Destapador / posavasos
- Almohadón / funda
- Rompecabezas / placa / chapa

### 4.4 Técnicas de decoración (personalizaciones / pasos)

Cada una consume su film/tinta por **área de la estampa** y su tiempo:

| Técnica | Sustrato típico | Familia motor |
|---|---|---|
| Sublimación | poliéster / rígidos con coating | `impresion_por_pieza` / transfer |
| DTF textil | algodón / mixtos | `aplicacion_transfer` |
| DTF UV | rígidos (tazas, botellas, lapiceras) | `impresion_por_pieza` |
| DTG | algodón | `impresion_por_pieza` |
| Serigrafía (1+ colores) | textil / rígido | (por definir) |
| Vinilo textil de corte (planchado) | textil | `aplicacion_transfer` |
| Bordado | textil | (por definir, por puntada) |
| Grabado láser | madera / metal / acrílico | (por definir) |
| Tampografía | rígidos chicos | (por definir) |

> Las técnicas ya cableadas a familia son las de Fase 1 (DTF UV / sublimación /
> DTF textil). El resto se agrega en fases posteriores.

## 5. Plan para la biblioteca

**Estrategia recomendada: extender la biblioteca (Opción A), no crear una entidad
nueva.** El motor ya costea el blank en el slot sustrato vía `por_pieza`; el hueco
es solo clasificación + UX + presets. Una entidad "producto comprado" separada
(Opción B) sería semánticamente más limpia pero implica tablas/UI/motor nuevos —
no se justifica para arrancar.

### Fase A — Biblioteca de blanks

1. **Subfamilia nueva** `TEXTIL_INDUMENTARIA` en `SubfamiliaMateriaPrima`
   (migración de enum + espejo en DTOs `upsert-materia-prima.dto.ts` y en los
   mapas `MP` de `familias.ts`). Merch rígido reutiliza `OBJETO_PROMOCIONAL_BASE`.
   Se mantienen bajo familia `SUSTRATO` para no romper la compat del motor
   (`MP.textil`, `MP.sustratoPieza`).
2. **Flag `esProductoBase`/`esReventa`** (opcional) en `MateriaPrima` para
   distinguir un blank comprado de un insumo de producción (reporting +
   filtrado UI).
3. **Templates**: `textil_indumentaria_v1` (`dimensionesVariante:["color","talle"]`)
   y `objeto_promocional_base_v1` (`dimensionesVariante:["color","modelo"]`).
4. **Presets** (`material-presets.js`): catálogo inicial de blanks comunes
   (remera algodón, buzo, gorra, tote bag; taza, botella, cuaderno, mousepad…),
   cada uno con sus variantes y precio de referencia editable.

### Fase B — Tipo de producto "comprado / personalizable"

5. **UX del producto**: cuando `unidadComercial="unidad"` y el producto es de
   reventa, **ocultar la sección de medida** y mostrar solo cantidad +
   personalizaciones. (Hoy la medida ya se ignora en el motor; esto es solo
   claridad de UI.)
6. **Wiring del producto**: blank en el slot sustrato (`por_pieza`) + paso de
   decoración vinculado a la personalización (`fuenteMedida`, ya implementado).

### Fase C — Pulido

7. **Precio por base** (aplicar un precio a todas las variantes de una vez) para
   evitar la duplicación 30×.
8. **Editor de matriz de variantes** (color × talle) para altas masivas.
9. Familias de proceso faltantes (serigrafía por color, bordado por puntada,
   grabado láser).

## 6. Relación con lo ya hecho

- La **decoración** (personalización con medida propia → costo film/tiempo) está
  **implementada** (`personalizaciones-diseno.md`): lib, backend, UI declarar, UI
  vincular paso (`fuenteMedida`), motor, sheet. Falta el E2E.
- Este documento cubre **el blank** (el otro lado del costo): cargarlo en la
  biblioteca y armar el tipo de producto que lo combina con la decoración.
- **Orden acordado**: analizar → taxonomía → cargar biblioteca → recién ahí
  probar el E2E de la Taza DTF UV (blank real + decoración real).

## 7. Anclas de código

- Producto: `schema.prisma:1414-1453`; `unidadComercial:1422`, `modoMedidas:1423`.
- MateriaPrima/Variante: `schema.prisma:1035-1102`; `precioReferencia:1080`.
- Familias enum: `schema.prisma:254-322`; `OBJETO_PROMOCIONAL_BASE:277`.
- Fórmulas de slot: `motor.service.ts:3011-3091`; `por_pieza:3040`.
- Familias motor: `familias.ts` `impresion_por_pieza:430`, `aplicacion_transfer:479`,
  `trabajo_manual:1427`.
- Presets: `apps/api/prisma/seed-modulos/material-presets.js`.
- Templates: `src/lib/materia-prima-templates.ts`.
- Alta UI: `src/components/inventario/materias-primas-panel.tsx:142`.
