# OT / ficha para productos personalizables — qué información mostrar

> 2026-07-13. Cómo nutrir la OT (orden de trabajo) con la info que el taller
> necesita cuando el producto es un blank comprado + decoración (remera, taza…).
> Relacionado: `merchandising-taxonomia-y-plan.md`, `personalizaciones-diseno.md`.

## 1. El problema

Al agregar una "Remera de algodón personalizada" a una OT, las especificaciones
muestran **Material = "Film DTF textil"** (el consumible de decoración),
**Tecnología** y **Modo de color** — pero **no** aparece:
- Qué tipo de producto es (más allá del nombre): rubro / prenda / objeto.
- La **prenda base** comprada (remera algodón) ni su **talle** y **color**.
- El detalle de las **estampas** (nombre, medida, ubicación).

El taller no puede preparar el pedido: no sabe qué remera tomar, de qué talle ni
color, ni qué estampa va en cada lugar.

## 2. Por qué no se ve (estado actual)

- Las specs de la OT salen de `item.atributosSchema` (atributos declarados del
  producto, visibles) + filas sintéticas (material principal / montaje), leyendo
  los valores de `item.especificaciones` (`propuesta-ficha.tsx` `specsBase`/`specs`).
- El **blank** (la remera) vive en el slot `textil` del paso de aplicación, que
  **no** está en `MATERIAL_BASE_SLOT_CODES` (`agregar-producto-sheet.tsx`) → nunca
  se surfacea. El "material" que se ve es el `sustrato_principal` del paso de
  impresión = el film.
- `setSpec` solo publica claves que estén en `ENRICHED_SPEC_LABELS` o en el schema
  del producto. No hay claves para tipo/prenda/talle/color/estampas.
- El dato SÍ existe: `slot.materialVariante.atributosVarianteJson` del blank trae
  `{ categoria, tipoPrenda|tipoObjeto, material, color, talle }`, y las
  personalizaciones traen `{ nombre, modoMedida, anchoMm, altoMm }` (+ la medida
  del cliente cargada al cotizar).

## 3. Qué info necesita la OT (taxonomía aplicada)

| Campo | Textil | Objeto | Fuente |
|---|---|---|---|
| Tipo de producto | "Textil · Remera" | "Objeto · Taza" | `categoria` + `tipoPrenda/tipoObjeto` del blank |
| Producto base (blank) | "Remera algodón" | "Taza cerámica" | nombre de la MateriaPrima del slot |
| Variante | talle + color | color / modelo / capacidad | `atributosVarianteJson` del variante |
| Material base | Algodón / Frisa | Cerámica / Acero | `material` del blank |
| Técnica | DTF textil | DTF UV / Sublimación | tecnología del paso (ya se muestra) |
| Estampas | pecho 12×8, espalda 30×35 | frente 8×8 | personalizaciones (nombre + medida) |
| Cantidad | 100 u | 100 u | comercial |

## 4. Solución — dos niveles

### Nivel 1 — Surfacing (nutre la OT con lo que hoy se elige) — recomendado ya

Sin cambiar el modelo de datos:

1. **Publicar specs enriquecidas** (`agregar-producto-sheet.tsx`): detectar el
   blank por sus atributos (`tipoPrenda`/`tipoObjeto`/`categoria` en
   `atributosVarianteJson` — señal única de los blanks) en cualquier slot HARDCODED
   o elegido, y hacer `setSpec` de:
   - `producto_tipo` → "Textil · Remera" / "Objeto · Taza"
   - `prenda` / `objeto` → nombre del blank + variante ("Remera algodón · Blanco · L")
   - `talle`, `color`, `material_base`
   - `personalizaciones` → multilínea: "Estampa en pecho · 12 × 8 cm", …
2. **Sumar las claves** a `ENRICHED_SPEC_LABELS` con sus labels.
3. **Renderizar** en `propuesta-ficha.tsx`: filas sintéticas para estas claves
   cuando existan en `especificaciones` (mismo patrón que "material principal").

Con esto la OT ya muestra: tipo, prenda/objeto, talle, color, material base y las
estampas — **el 90% de lo que el taller necesita**, sin tocar el costeo.

### Nivel 2 — Distribución de talles/colores (feature mayor) — a decidir

Hoy el slot elige **un** variante (un talle + un color) para toda la orden: 100
remeras = 100 del mismo talle. En la realidad una orden es un **mix** (S:20, M:40,
L:30, XL:10, y a veces varios colores). Resolverlo requiere:

- **Cotizador**: input de "cantidad por talle/color" (una grilla), no un solo
  variante. La cantidad total = suma.
- **Costeo**: el blank se costea por unidad (precio de compra); si hay recargo por
  talle especial, se toma el precio de cada variante. El resto de los pasos
  (impresión, aplicación) se costean sobre el total.
- **OT/producción**: muestra el desglose por talle/color (la "curva de talles"),
  que es lo que el taller usa para preparar.

Es un cambio de modelo (cantidad por variante en vez de un variante único) que
toca cotizador + motor + OT. Alto valor para indumentaria, pero es una fase propia.

## 5. Recomendación

- **Nivel 1 ahora**: surfacing de tipo/prenda/talle/color/material/estampas en la
  OT. Rápido, no cambia el costeo, resuelve la mayor parte del reclamo.
- **Nivel 2 después**: curva de talles (cantidad por talle/color) como feature
  dedicada para indumentaria.

## 6. Anclas de código

- Publicación de specs: `agregar-producto-sheet.tsx` `setSpec`:2509,
  `ENRICHED_SPEC_LABELS`:339, `MATERIAL_BASE_SLOT_CODES`:363.
- Render OT: `propuesta-ficha.tsx` `specsBase`:2851, `specs`:2878.
- Atributos del blank: `slot.materialVariante.atributosVarianteJson`
  (`productos-servicios.ts`:268).
