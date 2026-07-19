# Productos / pasos tercerizados — diseño

Estado: **diseño** (sin implementar). Análisis 2026-07-19 (v2, modelo por paso).
Encuadre: hay trabajos que compramos a un proveedor —a veces el producto entero
(offset), a veces un solo paso de la ruta (impresión UV a $/m² mientras el
refilado lo hacemos nosotros)— y el sistema no los soporta porque todo costo se
calcula por máquina + tiempo + material.

---

## 1. Objetivo

Poder cotizar trabajos cuyo costo (total o de algún paso) **lo pone un proveedor**,
no el motor. Tres variantes reales de una gráfica:

1. **Producto entero tercerizado, precio por matriz** — Folletos offset:
   `(10×15, 4/0, Ilustración 150, 1000) → $100` del proveedor.
2. **Producto entero tercerizado, precio por magnitud** — Impresión UV que no
   hacemos: el proveedor cobra **$/m²**.
3. **Producto parcialmente tercerizado (ruta mixta)** — "Vinilo + refilado": la
   **impresión del vinilo** la terceriza ($/m²), el **refilado** lo hace la
   empresa (paso interno del motor).

Todos deben ser **elegibles en el catálogo** como cualquier producto, entrar a la
cotización con su precio, y en la OT tratar el trabajo tercerizado como una
**compra** (no como producción interna).

---

## 2. Estado actual (el gap)

- El motor (`MotorUniversalService.cotizar`, `motor.service.ts:396`) itera los
  **pasos** de la ruta; **cada paso produce un costo** en `ejecutarPaso`
  (`motor.service.ts:1630`) a partir de máquina (tarifa horaria × tiempo),
  material, cargos y mano de obra. Suma los costos, y sobre el total aplica el
  precio (`AplicarPrecioService.aplicar`, switch por `metodoCalculo`).
- La config de cada paso vive en `ProductoConfigPaso` (schema `1695`): ahí el
  producto fija máquina, material, tarifas, params, dotación.
- `ejecutarPaso` ya tiene a mano la **magnitud** del trabajo (área m², metros
  lineales, cantidad, pliegos): calcula área desde piezas y lee
  `jobContext.metrosLineales` (`motor.service.ts:1263`, `3768`, `4677`).
- Guardas que hoy bloquean: un producto necesita ≥1 ruta
  (`producto-validacion.service.ts:27`) y cada paso interno necesita máquina.
- Infra reutilizable: `CotizacionItem.costoUnitario/costoTotal` nullable
  (schema `2074`), regla `sin_costeo` (`presupuestos/aprobacion.ts:47`), snapshot
  congelado del ítem (`precioConfigSnapshotJson`, `2085`), y
  `OrdenTrabajoItemPaso` con estados por paso (schema `2210`).

**No existe** hoy la noción de un paso cuyo costo lo pone un proveedor.

---

## 3. Framework — la idea clave

El motor ya trabaja por **pasos que suman costo**. La tercerización es una
**propiedad del paso**, no del producto:

> Un paso puede ser **interno** (máquina + tiempo + material) o **tercerizado**
> (proveedor). Un paso tercerizado toma su costo de una **fuente enchufable**, y
> el motor lo suma igual que a cualquier paso. Todo lo de abajo —precio, margen,
> impuestos, snapshot, materialización en la OT— es idéntico.

### 3.1 Fuentes de costo de un paso tercerizado

| Fuente | Cómo cuesta | Entrada que necesita | Caso |
|---|---|---|---|
| **`tarifa_magnitud`** | `costo = max(tarifa × max(magnitud, mínMagnitud), mínCosto)` | `magnitud` (`area_m2`/`ml`/`perimetro_ml`/`cantidad`/`pliegos`) + `tarifa` (+ mínimos opcionales); la magnitud la calcula el motor | UV, vinilo $/m², confección por perímetro |
| **`matriz`** | lookup **exacto** por ejes discretos → `costo` (sólo combinaciones listadas; no interpola ni redondea) | ejes + tabla de entradas; el comercial elige un valor por eje | Folletos offset |
| **`fijo`** | `costo` fijo por trabajo o por unidad | `costo` + `por` (`trabajo`/`unidad`) | fees planos, troquel/cliché |

### 3.2 Los tres casos, mapeados

- **Offset** = ruta de **1 paso tercerizado `matriz`**. `modoMedidas=FIJA`; la
  "medida" es un eje discreto, no una dimensión real.
- **UV total** = ruta de **1 paso tercerizado `tarifa_magnitud`** (área m²).
  `modoMedidas=LIBRE`; medida real, la usa el motor.
- **Vinilo + refilado** = ruta de **2 pasos**:
  `[impresión vinilo — tercerizado tarifa_magnitud $/m²] → [refilado — interno]`.
  El motor corre el paso interno normal y resuelve el tercerizado por su fuente;
  **suma ambos costos**. La secuencia la da el orden de la ruta.

El "producto totalmente tercerizado" **no es un tipo especial**: es el caso donde
todos los pasos de la ruta son tercerizados. Como igual tiene una ruta (aunque sea
de 1 paso), **respeta la guarda de "≥1 ruta" sin bypass**: sólo hay que relajar
que un paso tercerizado no exija máquina/material.

### 3.3 Costo → precio (decisión: costo + margen)

La fuente da el **costo del proveedor**. El motor lo suma al costo de la ruta y
aplica el precio con `precioConfigJson` (`por_margen`) → margen y contribución
siguen vivos en reportes. `margenNegativo` avisa si el precio cae bajo el costo.

---

## 4. Modelo de datos (propuesto)

### 4.1 `ProductoConfigPaso` (campos nuevos)

- `tercerizado Boolean @default(false)`.
- `proveedorId String?` — registro de Proveedores.
- `fuenteCostoTercerizado String?` — `'tarifa_magnitud' | 'matriz' | 'fijo'`.
- `tercerizadoConfigJson Json?` — según fuente:
  - `tarifa_magnitud`: `{ magnitud: 'area_m2'|'ml'|'perimetro_ml'|'cantidad'|'pliegos',
    tarifa, minimoMagnitud?, minimoCosto? }`. Los mínimos son opcionales:
    `minimoMagnitud` es el piso de la magnitud (ej. mínimo 1 m²); `minimoCosto` es
    el piso del costo resultante (ej. mínimo $20.000 por pedido).
  - `matriz`: `{ ejes: [{ clave, label, orden, valores:[{clave,label}] }] }`
    (las filas van en tabla, §4.2).
  - `fijo`: `{ costo, por: 'trabajo'|'unidad' }`.
- `plazoProveedorDias Int?` — lead time del proveedor (para la ETA de la OT).

Un paso tercerizado **conserva su `RutaPaso.familiaCodigo`** (impresión, laminado…)
por reporting ("cuánto tercerizamos de impresión"), pero su costo NO sale de
máquina/material sino de la fuente. Se relaja `producto-validacion.service.ts`
para no exigirle máquina.

### 4.2 `PasoTercerizadoEntrada` (tabla nueva — sólo para `matriz`)

```
model PasoTercerizadoEntrada {
  id          String   @id @default(uuid())
  tenantId    String
  configPasoId String                  // FK a ProductoConfigPaso
  valoresJson Json                      // { ejeClave: valorClave } — para mostrar
  claveMatch  String                    // concat canónico en orden de eje → lookup O(1)
  cantidad    Int                       // unidades de la tanda (deriva unitario)
  costo       Decimal  @db.Decimal(14,2) // costo TOTAL del proveedor para la tanda
  activo      Boolean  @default(true)
  @@unique([configPasoId, claveMatch])
  @@index([tenantId, configPasoId])
}
```

Tabla dedicada (no JSON inline): las listas de proveedor tienen cientos de filas,
se importan por CSV y se editan por fila. El histórico no depende de la tabla: el
`CotizacionItem` ya congela costo/precio y guarda la entrada usada en su snapshot.

### 4.3 Item y OT

- `CotizacionItem`: sin cambios de schema. La selección (valores de eje o la
  medida) va en `jobContextJson`; la entrada/valores usados, en `snapshotJson`.
- `OrdenTrabajoItemPaso` (schema `2210`): un paso tercerizado se materializa con
  `tipoEjecucion = 'tercerizado'` y **estado de compra** (§6), sin máquina.

---

## 5. Motor — la rama en `ejecutarPaso`

En `ejecutarPaso` (`motor.service.ts:1630`), **antes** de calcular tarifa/tiempo:

```
if (configPaso.tercerizado) {
  const costo = resolverCostoTercerizado(configPaso, jobContext, magnitud);
  //  - tarifa_magnitud: max(tarifa × max(magnitud, mínMag), mínCosto)
  //  - matriz:          findUnique por claveMatch (exacto; error si no existe)
  //  - fijo:            costo (× cantidad si por='unidad')
  return { costo, tiempo: 0, maquina: null, tercerizado: true, ... };
}
// … cálculo interno normal (máquina + tiempo + material) …
```

**Magnitud `perimetro_ml` (nueva).** El motor hoy expone área m², metros
lineales de corte/film, pliegos y piezas, pero **no perímetro**. Se agrega
`perimetro_ml` al cálculo de magnitudes (perímetro de la pieza = `2·(ancho+alto)`
× piezas), para costear confección/soldado por metro lineal de borde.

- Rutas mixtas: el motor corre los pasos internos y los tercerizados y **suma**;
  no hay caso especial aguas arriba.
- Un paso tercerizado aporta **costo pero 0 tiempo de máquina** (no consume
  capacidad interna). Sí puede aportar `plazoProveedorDias` al lead time.
- `CotizarOutput`: el desglose marca qué pasos son tercerizados (para mostrarlo).

---

## 6. Producción / OT — compra con seguimiento (decisión)

Un paso tercerizado en la OT **es una compra al proveedor**, no producción:

- **No entra al tablero ni consume capacidad de máquina**: el tablero/estaciones
  filtran por máquina; un paso sin máquina no aparece ahí. Se muestra en una
  **lane/panel "Compras / Tercerizados"**.
- **Estado de compra** del paso: `pendiente → pedido → recibido → entregado`
  (+ fecha por transición), mapeado sobre `OrdenTrabajoItemPaso` con
  `tipoEjecucion='tercerizado'`. Es la "producción" del paso a efectos del
  progreso de la OT.
- **Rutas mixtas y secuencia**: en "vinilo + refilado", el refilado **depende** de
  recibir la impresión — el orden de la ruta ya lo impone (el paso interno queda
  bloqueado hasta que el tercerizado esté `recibido`). El refilado va al tablero
  normal; la impresión, al panel de compras.
- **Proveedor y plazo**: `proveedorId` dice a quién comprarle;
  `plazoProveedorDias` alimenta la ETA. La orden de compra automática es F3; en
  v1/F2 el avance de estado es manual.
- El progreso de la OT (`progresoPct`, `fechaFinalizada`) considera el estado de
  compra de los pasos tercerizados igual que el estado de los pasos internos.

---

## 7a. Setup — UI de creación (decidido 2026-07-19)

**No hay flujo nuevo ni sección aparte.** El tercerizado se crea desde el mismo
módulo **Productos y servicios** (integrado); un producto tercerizado es un
producto normal cuya ruta tiene ≥1 paso marcado tercerizado.

- **Listado** (`productos-table.tsx`): badge "Tercerizado" (o "Parcial") + un
  filtro para encontrarlos rápido. Requiere un flag derivado a nivel producto
  (¿algún configPaso tercerizado?), calculado en `listarProductos`.
- **Editor de paso** (`config-pasos-editor-view.tsx`, panel del paso ~L4790): un
  toggle **"Lo terceriza un proveedor"**. Al activarlo, el bloque de máquina/
  material se reemplaza por: **proveedor**, **fuente de costo** (matriz / tarifa
  por magnitud / fijo), **plazo del proveedor**, y el editor de la fuente:
  - **matriz**: ejes (agregar eje + sus valores como chips) → la **grilla se
    auto-genera** con todas las combinaciones (cantidad como columnas); el usuario
    **llena los costos** en cada celda y puede **borrar** las filas que el
    proveedor no ofrece. Cero CSV — todo en la grilla.
  - **tarifa por magnitud**: magnitud (área/ml/perímetro/cantidad) + tarifa +
    mínimos opcionales.
  - **fijo**: costo + por (trabajo/unidad).
- **Pricing** (tab existente): margen con `por_margen`.

## 7b. Cotización — UI (según la fuente de costo)

- Catálogo (paso select): **sin cambios** — aparece por `activo`. Badge
  "Tercerizado" / "Parcial" para distinguir.
- Config, según la fuente del/los paso(s) tercerizado(s):
  - **`tarifa_magnitud`**: se captura con la **UI de medidas normal** (área/ml);
    el paso tercerizado multiplica por su tarifa. Nada nuevo que capturar.
  - **`matriz`**: se renderiza **un selector por eje** (medida/faz/papel/
    cantidad); al completar, el lookup da el costo. Si la combo no existe, estado
    claro ("no disponible").
  - **`fijo`**: nada que capturar.
- El precio se dispara con el mismo `cotizar` y se muestra igual. Rutas mixtas:
  conviven la UI de medidas (para el refilado/impresión) y, si algún paso es
  matriz, sus selectores.

---

## 8. Casos borde

| Caso | Tratamiento |
|---|---|
| Combinación no listada (matriz) | Error "no disponible"; la UI ofrece sólo combos válidos. |
| Cantidad off-grid (matriz) | No se permite: cantidad es un eje discreto (decisión "sólo listadas"). |
| Cantidad en `tarifa_magnitud` | Continua: `tarifa × magnitud` para cualquier medida/cantidad. |
| Mínimo del proveedor | `tarifa_magnitud` aplica `minimoMagnitud` (piso de m²/ml) y `minimoCosto` (piso del costo por pedido). Ej. UV $8.000/m² mínimo $20.000. |
| Confección por perímetro | Nueva magnitud `perimetro_ml` = `2·(ancho+alto)·piezas`; el paso tercerizado la multiplica por su tarifa. |
| Proveedor actualiza precios | Se edita/reimporta; cotizaciones viejas quedan congeladas por el snapshot del ítem. |
| Precio < costo | Flag `margenNegativo`. |
| Ruta mixta | El motor suma pasos internos + tercerizados; la OT rutea cada uno a su carril. |
| OT con pasos tercerizados y el interno depende | El paso interno queda bloqueado hasta `recibido` (orden de ruta). |
| Reventa sin costo conocido | `costo` null → regla `sin_costeo`. Opcional en v1. |
| Lead time | El paso tercerizado suma `plazoProveedorDias` a la ETA de la OT. |
| Import de la matriz | CSV del proveedor (ejes + cantidad + costo). Clave para usabilidad. |
| IVA | La venta lleva IVA como siempre; el costo es costo. Sin cambios fiscales. |

---

## 9. Journey

1. **Setup** (admin): arma el producto y su ruta. Marca los pasos que compra como
   tercerizados y les carga la fuente:
   - Offset: 1 paso `matriz` + carga de la lista (CSV).
   - UV: 1 paso `tarifa_magnitud` con el $/m².
   - Vinilo+refilado: paso "impresión" tercerizado `tarifa_magnitud` + paso
     "refilado" interno normal. Asigna proveedor y plazo a los tercerizados.
2. **Cotización** (comercial): elige el producto; según la fuente, setea medida
   (UV/vinilo) o valores de eje (offset) → precio con margen → agrega.
3. **OT** (al aprobar): los pasos tercerizados van al panel "Compras /
   Tercerizados" (`pendiente → pedido → recibido → entregado`); los internos, al
   tablero. Los internos que dependen de un tercerizado esperan a `recibido`.

---

## 10. Fases

- **F1 — Costeo tercerizado por paso + catálogo + cotización.** Campos en
  `ProductoConfigPaso`, tabla de matriz, rama en `ejecutarPaso`, relajar la
  validación de máquina (todo ✅ hecho), + **ABM por UI** (toggle + fuente +
  grilla auto-generada en el editor de paso; badge/filtro en el listado) y la UI
  de captura en el cotizador. Cubre las 3 variantes (el 80% del valor).
- **F2 — OT: compra con seguimiento.** `tipoEjecucion='tercerizado'` +
  estado de compra en el paso, panel de compras en la OT, bloqueo por dependencia,
  progreso/ETA con `plazoProveedorDias`.
- **F3 (futuro) — Compras/proveedor.** Orden de compra al proveedor desde la OT,
  recepción, costo real vs. lista.

---

## 11. Decisiones

**Tomadas (2026-07-19):**
- **A. Costo del proveedor + margen** (reusa `por_margen`; margen en reportes).
- **B. Matriz = sólo cantidades listadas** (lookup exacto; sin interpolar). Aplica
  a la fuente `matriz`; `tarifa_magnitud` es continua por naturaleza.
- **C. OT = compra con seguimiento** (`pendiente → pedido → recibido → entregado`,
  fuera del tablero).
- **D. Tercerización por PASO, no por producto** (v2): unifica offset, UV y rutas
  mixtas; el producto totalmente tercerizado es el caso de ruta 100% tercerizada.
- **E. Mínimos del proveedor** (validado con casos reales): `tarifa_magnitud`
  soporta `minimoMagnitud` y `minimoCosto`.
- **F. `perimetro_ml` como magnitud del motor** (no input manual): se calcula
  desde las piezas, para confección/soldado por perímetro.
- **G. Setup 100% por UI, integrado** (no CSV, no sección aparte): el tercerizado
  es un toggle del paso en el editor normal de productos; la matriz se llena en una
  **grilla auto-generada** (ejes → combinaciones → costos, borrando las que no
  aplican); badge/filtro "Tercerizado" en el listado.

**Límites conocidos aceptados en v1:**
- **Ruta lineal, no DAG** (`orden` simple): las dependencias convergentes se
  resuelven por orden; el paralelismo real no se modela → la ETA queda
  conservadora. El costo NO se afecta. DAG real es un cambio grande y transversal.
- **Herramental reutilizable** (troquel/cliché) entre pedidos: se cotiza por
  trabajo (`fijo`); no recomprarlo en un repeat es manual por ahora.
- **Costos en NETO**: la matriz/tarifa se carga sin IVA (el IVA del proveedor es
  crédito fiscal, no costo), consistente con el resto del sistema.

**Abiertas:**
- Familia de un paso tercerizado: ¿la real (impresión) por reporting, o una
  genérica "TERCERIZADO"? (Sugerido: la real + flag.)
- Ergonomía del setup: ¿un wizard/template que cree la ruta de 1 paso tercerizado
  para el caso "producto entero comprado", así el usuario no arma la ruta a mano?
  (Sugerido: sí.)
- Import CSV de la matriz: ¿F1 o F2? (Sugerido: F1.)
- ¿`tarifa_magnitud` soporta tramos por volumen (descuento por m² a mayor área)?
  (Sugerido: no en v1; si hace falta, se modela como `matriz`.)
