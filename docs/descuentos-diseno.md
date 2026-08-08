# Descuentos — diseño

Estado: **F1 completo (backend + front UI). Falta verificación interactiva en
el navegador.** Rama `feat/descuentos`. Ver §10 para el detalle.

Objetivo: poder aplicar descuentos en una cotización / OT. Varios tipos:
**por % o monto**, sobre **un item** o sobre **la orden**, y por **cupón de
descuento** (código, para sorteos y promos) que puede estar acotado a una
categoría / producto / cliente.

Hoy **no existe** ningún concepto de descuento en el pricing ni en la ruta del
dinero (sólo dos placeholders sin uso, ver §2.4).

---

## 1. Por qué esto necesita diseño antes que código

Un descuento no es "restar un número en la UI". El monto de una orden alimenta
—desde una **única fuente de verdad**— la deuda del cliente, la **factura
electrónica (CAE de AFIP/ARCA)** y las ventas de los reportes. Un descuento que
viva sólo en el front deja: deuda inflada, factura con IVA sobredeclarado y
Panel con ventas/márgenes por encima de lo real. Además, como el **costo es
fijo**, un descuento **se come el margen** y puede volverlo negativo — hay que
controlarlo.

---

## 2. Estado actual (relevamiento)

### 2.1 El pipeline de precio

```
Costo (motor universal)                      apps/api/src/motor-universal/motor.service.ts
  → Motor de precio  aplicar()               apps/api/src/productos-servicios/precio/aplicar-precio.service.ts
       neto = costo / (1 − margen% − cargasInternas%)     (gross-up)
       impuestosPorFuera = neto × IVA%
       bruto = neto + impuestosPorFuera
       precioBase = neto − costosInternos − comisiones
       margenEfectivoPct = (precioBase − costo) / neto × 100
  → CotizarResponse.desglosePrecio           src/lib/productos-servicios-api.ts
  → PropuestaItem                            src/lib/propuestas.ts
       subtotal = precioNetoTotal (NETO, sin IVA)
       total    = precioBrutoTotal (con IVA)
```

Claves:
- **Comisiones y margen viven DENTRO del neto**; el IVA se apila arriba.
- Impuestos **por fuera** (IVA): se agregan al neto, se discriminan al cliente.
  Impuestos **por dentro** (IIBB, imp. al cheque) y **comisiones**: embebidos en
  el neto vía gross-up (se auto-escalan como % del neto).

### 2.2 La fuente de verdad del monto

**El backend NO calcula precio** — el cotizador/front lo calcula y manda los
montos crudos. El backend suma, snapshotea y arrastra. La fuente de verdad es:

- `OrdenTrabajoItem.subtotal / impuestos / total`  — `schema.prisma:2872-2874`
- `OrdenTrabajo.total` (Σ items + cargos)          — `recalcularTotales`, `ordenes-trabajo.service.ts:1049`

De ahí sale TODO lo de abajo:

| Consumidor | Cómo lee el monto | Archivo |
|---|---|---|
| Deuda comercial | `total − cobradoTotal` | `cuenta-corriente.service.ts:15` |
| Factura AFIP (CAE) | `saldo = total − facturadoTotal` → neto/IVA | `comprobantes.service.ts:822`, `invoicing/totales-comprobante.ts` |
| Nota de crédito | revierte sobre `factura.total` | `facturacion-ordenes.service.ts:249` |
| Reportes / Panel | `SUM(OrdenTrabajoItem.subtotal)` | `reportes/ventas.service.ts:63` |

**Conclusión dura:** el descuento tiene que estar incorporado en
`OrdenTrabajoItem.subtotal/impuestos/total` **en o antes de la emisión**.

### 2.3 Precedente: cargos directos por orden

`cargosOrden` / `PropuestaCargoDirecto` es el ajuste manual por orden más
parecido a un descuento, PERO **no se reusa como "cargo negativo"**:
- `buildCargoOrdenSnapshot` bloquea negativos (`Math.max(0, …)`), IVA
  hardcodeado 21%, y `consolidarCostosOrden` lo trata como **costo** que baja
  margen. Un descuento **no es costo, es reducción de ingreso**: contarlo como
  costo negativo inflaría el margen falsamente.
- Al emitir, `cargosOrden` se colapsa a **un solo número** (`cargosDirectos`) —
  se pierde el detalle. Un descuento necesita **trazabilidad** (motivo, quién
  autorizó, %).

Se reusa la **mecánica**, no el campo: patrón de snapshot congelado, los
`modoCalculo` `MONTO_FIJO_PLANO` / `PORCENTAJE_SOBRE_BASE`, el catálogo opcional
como plantillas, y el eje de cálculo `calcularResumenOrden` / `consolidarCostosOrden`.

### 2.4 Hooks latentes que ya existen (a aprovechar)

- **`bonificacionPct`** en la capa de facturación AFIP (`invoicing/totales-comprobante.ts:42`):
  aplica un descuento por línea **antes del IVA**. Es exactamente la semántica
  fiscal correcta, pero hoy se tipea a mano al facturar y está **desconectado**
  del pricing de la orden. → El descuento de la orden debería **alimentar** este
  campo al facturar.
- **`aprobacionDescuentoMaxPct`** (`schema.prisma:2706`, config del tenant) y el
  permiso **`comercial.aprobar_descuento`** — existen y **no se usan**. Son el
  gate de aprobación listo para cablear.
- **`aprobacionMotivosJson`** en `Cotizacion` (`schema.prisma:2631`) — mecanismo
  de motivos/aprobación ya modelado.
- **`ProductoPrecioEspecialClienteV2`** — override de precio por cliente (no es
  descuento, pero es el precedente de "trato distinto por cliente").

### 2.5 Para cupones con alcance

- **Categoría comercial** (para "cupón aplica a categoría X"):
  `ProductoCategoriaComercial` → `ProductoSubcategoriaComercial` → `Producto.subcategoriaComercialId`.
  Catálogo global. **No** usar familia de pasos (eso es proceso de fábrica).
- **Cliente**: se scopea directo a `Cliente.id` (no hay segmentos/listas).
- **Código / token único**: reusar el patrón `EnlacePublico` (token opaco
  `randomBytes(9).base64url`, 12 chars, con `expiraEl`/`revocadoEl`/`visitas`,
  extensible con un tipo `CUPON`) para cupones-secreto de sorteo; o el contador
  atómico `REC-AAAA-NNNN` para códigos tecleables.
- **Multi-tenant**: `tenantId` + guard automático, `@@unique([tenantId, codigo])`.

---

## 3. Marco: dimensiones del descuento

Un descuento se define por ejes ortogonales:

| Eje | Valores |
|---|---|
| **Alcance** | Item específico · Orden completa (prorrateada a items) |
| **Tipo** | Porcentaje (%) · Monto fijo ($) |
| **Origen** | Manual (comercial, con motivo) · Cupón (código + reglas) |
| **Base** | Sobre el **neto** (antes de IVA) — decisión firme, ver §4 |
| **Momento** | Antes de emitir (cotización/OT). Post-emisión = nota de crédito (fuera del alcance inicial) |

Un cupón agrega **reglas**: alcance (categoría/producto/cliente), vigencia
(`desde`/`hasta`), tope de uso (un solo uso / N usos / ilimitado), valor
(% o $), y opcionalmente monto mínimo de compra.

### Interacciones críticas

- **IVA:** el descuento se aplica **antes del IVA**, sobre el neto → reduce la
  base imponible (estándar en Argentina, y lo que ya hace `bonificacionPct`).
- **Comisiones:** son % del neto. Si el neto baja por descuento, la comisión
  del vendedor **baja proporcional** (decisión §4).
- **Margen:** el costo es fijo → el descuento sale del margen. Puede volverlo
  negativo. **Se expone `margenEfectivoPct` post-descuento y se cablea el gate
  `aprobacionDescuentoMaxPct` / margen mínimo.**
- **Orden completa:** se **prorratea a los items** (no como línea suelta),
  porque margen, contribución e IVA por alícuota se computan sumando por item.

---

## 4. Decisiones de negocio a confirmar

Estas las definís vos; el diseño técnico depende de ellas:

1. **¿El descuento reduce la base imponible del IVA?**
   Recomendado: **SÍ** (estándar AR; el cliente paga IVA sobre el precio con
   descuento). Implica aplicarlo sobre el neto, antes del IVA.
2. **¿La comisión del vendedor se calcula sobre el precio con o sin descuento?**
   Recomendado: **con descuento** (vende a ese precio; comisión sobre lo real).
3. **¿Hay piso de margen?** ¿Un descuento que deja margen < X% requiere
   aprobación (`comercial.aprobar_descuento`)? Recomendado: **SÍ**, cableando el
   `aprobacionDescuentoMaxPct` que ya existe + margen mínimo.
4. **¿Se pueden apilar descuentos?** (ej. un cupón + uno manual). Recomendado
   para F1: **uno por eje** (un descuento de orden y/o uno por item), sin stack
   de varios cupones. Definir después si hace falta.
5. **Cupones — ¿quién los ingresa?** F1: sólo el **comercial** en la OT. Futuro:
   el **cliente** en el link público de presupuesto (self-service, para sorteos).
6. **Redención de cupón de un solo uso:** ¿se "consume" al aplicarlo en el
   presupuesto, al emitir la OT, o al facturar? Recomendado: al **emitir la OT**
   (es el compromiso real).

---

## 5. Modelo de datos propuesto

Descuento **separado** de `cargosDirectos` (distinta semántica).

### 5.1 Descuento en la línea (fuente de verdad)

Campos nuevos en `CotizacionItem` y espejados a `OrdenTrabajoItem`:

```
descuentoTipo    'PORCENTAJE' | 'MONTO' | null
descuentoValor   Decimal?          // el % o el $ ingresado
descuentoMonto   Decimal?          // el $ efectivo aplicado sobre el neto (congelado)
descuentoSnapshotJson Json?        // { origen: 'MANUAL'|'CUPON', motivo, cuponId?, autorizadoPor?, baseNeto, margenResultantePct }
```

El `subtotal/impuestos/total` del item se **recalculan** con el descuento (no se
guarda el bruto sin descontar). Así deuda, factura y reportes leen el neto ya
descontado desde la única fuente de verdad.

### 5.2 Descuento a nivel orden

Se **prorratea a los items** al aplicarlo (cada item recibe su `descuentoMonto`
proporcional al neto). En la orden se guarda el agregado para el listado:

```
OrdenTrabajo.descuentoTotal  Decimal?   // Σ descuentos de items (denormalizado)
Cotizacion.descuentosJson    Json?      // detalle para rehidratar la ficha
```

### 5.3 Cupón (F3)

```
model Cupon {
  id, tenantId
  codigo            // @@unique([tenantId, codigo]) — tecleable, o token opaco para sorteo
  tipo              'PORCENTAJE' | 'MONTO'
  valor
  alcanceTipo       'ORDEN' | 'CATEGORIA' | 'SUBCATEGORIA' | 'PRODUCTO' | 'CLIENTE'
  alcanceId?        // FK según alcanceTipo
  montoMinimo?
  vigenciaDesde/Hasta
  usoMax?           // null = ilimitado; 1 = sorteo un solo uso
  usoCount          // contador de redención
  activo
}
model CuponRedencion { id, tenantId, cuponId, cotizacionId/ordenId, montoAplicado, fecha }
```

El `CargoDirectoCatalogo` existente puede servir de inspiración para un
**catálogo de descuentos predefinidos** (ej. "cliente frecuente 10%"), aunque un
modelo propio es más claro.

---

## 6. Casos de uso

1. **% al total** — comercial: "10% a toda la orden", motivo "cierre de mes".
   Se prorratea a items, baja el neto de cada uno, recomputa IVA/total. Si el
   margen queda bajo el piso → "requiere aprobación".
2. **$ a un item** — "sacale $5.000 a este producto". Sólo esa línea.
3. **Cupón de sorteo** — código `SORTEO2026` = 20% off, sólo categoría
   "Cartelería", un solo uso, vence 31/12. El comercial ingresa el código; el
   sistema valida vigencia/uso/alcance y aplica a los items de esa categoría.
4. **Cliente frecuente** — descuento predefinido del catálogo, 10% para tal
   cliente, se ofrece automáticamente.

---

## 7. Journey

- **Comercial (OT):** botón **"Descuento"** junto a "Agregar cargo". Sheet:
  alcance (orden / item), tipo (% / $), valor, motivo, **o** ingresar código de
  cupón. **Preview del impacto**: nuevo total + **margen resultante** con
  warning si queda bajo. Si supera el umbral → marca "requiere aprobación".
- **Resumen financiero:** línea **"Descuento −$X"** en la barra y en el desglose
  del item (precio de lista tachado → precio con descuento).
- **Cliente (presupuesto/PDF/tracking):** ve el descuento aplicado.
- **Facturación:** el descuento ya está en el neto del item → la factura AFIP
  sale correcta; alternativamente se mapea a `bonificacionPct` por línea del
  comprobante (que ya existe).
- **Reportes:** ventas = `SUM(subtotal descontado)` → refleja lo real.

---

## 8. Etapas de implementación

- **F1 — Descuento manual (item + orden), motor de precio + persistencia.**
  Aplicar el descuento sobre el neto en `aplicar-precio.service.ts` (o en el
  serializado del item), persistir en `CotizacionItem`/`OrdenTrabajoItem`,
  prorrateo de orden a items, y que `consolidarCostosOrden` / `getItemOrderVisibleAmounts`
  lo lean. Golden master del pricing antes de tocar el motor.
- **F2 — UI + resumen + PDF/tracking.** Sheet de descuento con preview de
  margen; línea "Descuento" en el resumen y en el desglose; mostrarlo al cliente.
- **F3 — Aprobación por umbral.** Cablear `aprobacionDescuentoMaxPct` +
  `comercial.aprobar_descuento` + `aprobacionMotivosJson`.
- **F4 — Cupones con alcance.** Modelo `Cupon`/`CuponRedencion`, validación de
  vigencia/uso/alcance, catálogo/ABM, ingreso por código en la OT.
- **F5 — Facturación coherente.** Mapear el descuento al `bonificacionPct` (o al
  neto) del comprobante AFIP; verificar deuda/reportes.
- **F6 (futuro) — Cupón self-service.** El cliente ingresa el código en el link
  público del presupuesto (sorteos), con redención de un solo uso.

---

## 9. Riesgos y trampas

- **Redondeo:** `roundVisibleCurrency` y el residuo que absorbe el último
  impuesto interno (`costos-orden.ts:183`). El prorrateo del descuento de orden
  debe cuadrar al centavo con el agregado.
- **Snapshot congelado:** al emitir, el descuento debe quedar congelado en el
  snapshot del item (como los impuestos/comisiones), no recalcularse después.
- **Margen negativo:** permitido sólo con aprobación; nunca silencioso.
- **Coherencia `total = subtotal + impuestos`:** la validación backend
  (`ordenes-trabajo.service.ts:~1762`) debe seguir cerrando con el descuento.
- **No romper cargos directos:** descuento y cargo son ejes separados; el total
  es `subtotal_items − descuento + impuestos(base descontada) + cargosDirectos`.

---

## 10. Estado de implementación (F1) — handoff

Enfoque elegido: **A (motor = autoridad única)**. El descuento viaja en el
request de cotización → el motor lo aplica sobre el neto → el `desglosePrecio`
ya vuelve descontado por todo el pipeline. El front sólo manda el descuento y
muestra lo que vuelve (no duplica matemática de precio).

### ✅ F1.1 — Motor de precio (testeado)
`apps/api/src/productos-servicios/precio/aplicar-precio.service.ts`
- `AplicarPrecioInput.descuento?: { tipo: 'PORCENTAJE'|'MONTO'; valor }`.
- Se aplica apenas se calcula el neto de lista (`calcularDescuentoUnitario`);
  IVA, comisiones y margen recomputan solos. Neto clampeado ≥ 0; margen puede ir
  negativo. `MONTO` es sobre el neto total de la línea (prorratea por unidad).
- Output: bloque `descuento { aplicado, montoUnitario, montoTotal,
  netoListaUnitario, netoListaTotal }`.
- Tests: `__tests__/aplicar-precio.service.spec.ts` (44, golden master intacto).

### ✅ F1.2 — Contrato de cotización (backend + front-lib, testeado)
- DTO: `cotizar.dto.ts` → `DescuentoCotizarDto` + `CotizarDto.descuento`.
- `tipos.ts`: `CotizarInput.descuento` + `desglosePrecio.descuento`.
- `motor.service.ts`: `calcularPrecioConSnapshots` toma `descuento` → `aplicar()`,
  lo devuelve, y `cotizar()` lo pasa (884) y lo pone en `cotizacion.desglosePrecio`.
  Threaded en `recotizarItem` y (vía `input`) en `cotizarYGuardar`.
- `motor.controller.ts`: los 3 endpoints pasan `dto.descuento` (recotizar suma
  `'descuento'` al `Pick`).
- Front-lib `src/lib/productos-servicios-api.ts`: `CotizarRequest.descuento` +
  `CotizarResponse...desglosePrecio.descuento`.

### ✅ F1.3 — Persistencia (migración + escritura, testeado)
- Migración `20260808130000_descuento_comercial` (aditiva, aplicada a dev):
  `OrdenTrabajoItem.descuentoTipo/Valor/Monto`, `OrdenTrabajo.descuentoTotal`,
  `CotizacionItem.descuentoTipo/Valor/Monto`.
- `crear-orden-trabajo.dto.ts`: item acepta `descuentoTipo/Valor/Monto`.
- `ordenes-trabajo.service.ts`: persiste por item + `descuentoTotal = Σ
  descuentoMonto` (denormalizado; el descuento YA está dentro de `subtotal`, no
  se resta de nuevo). `recalcularTotales` y `buildItemData` (edición) consistentes.
- `motor.service.ts` `buildCotizacionItemData`: persiste el descuento en el
  `CotizacionItem` (tipo/valor del input, monto del desglose).

**Todo lo anterior está inerte hasta que el front mande un descuento.** Verificado:
API tsc + front tsc + `aplicar-precio`/`cotizar-dto`/`costos-orden` specs verdes.

### ✅ F1.4 — Front UI (implementado; falta smoke test en el browser)

Todo en `src/components/comercial/propuesta-ficha.tsx` salvo el read del API.
Modelo elegido: **todo colapsa a un descuento por línea** (`PropuestaItem
.descuentoInput = { tipo, valor }`). El descuento de ORDEN no es un eje aparte:
se materializa por item (un % se copia igual a cada línea; un monto se prorratea
por peso del neto de lista y el último item absorbe el residuo). Así sobrevive a
cualquier recotización sin matemática duplicada — el motor sigue siendo la única
autoridad.

Lo implementado (mapea 1:1 con los pasos de abajo):
1. **Estado** `descuentoInput` en `PropuestaItem` (propuestas.ts). Se enhebra en
   TODA (re)cotización: `persistirItemOrden`, `recotizarItemsPorCliente`,
   `recotizarPaneles` y el nuevo `recotizarItemConDescuento`. `applyCotizacionToItem`
   lo preserva por spread.
2. **Aplicar = recotizar**: `recotizarItemConDescuento` (una línea) +
   `aplicarDescuento(scope, itemId, input|null)` (item u orden con prorrateo).
3. **Modal**: `DescuentoModal` (centrado, módulo propio `descuento-modal.module.css`
   al estilo del modal de acomodado). Es `target`-driven: se abre **por fila**
   (acción "Descuento" junto a "Editar especificaciones", `scope=item`) o **desde
   la barra de resumen de abajo** (botón "Descuento", `scope=orden`). Alcance
   editable, tipo %/$, preview monetario (neto de lista → descontado).
4. **Mostrarlo**: en la fila con descuento, la celda **Subtotal** muestra el
   precio de lista tachado → el descontado + un tag `−%`/`−$` (clases del módulo
   de descuento, sin globales nuevas). Además: línea "Descuento −$X" en
   `ResumenBar` (informativa; el total ya viene descontado) y banda "Precio de
   lista … → neto" en el detalle expandido del item.
5. **Emisión**: `itemToOrdenItemPayload` manda `descuentoTipo/Valor/Monto`
   (monto = `desglosePrecio.descuento.montoTotal`). El DTO ya los aceptaba.
6. **Rehidratar**: el read staff del API (`ordenes-trabajo.service.ts` `toDetalle`)
   ahora expone `descuentoTipo/Valor/Monto`; `OrdenTrabajoProducto` +
   `CrearOrdenTrabajoItemPayload` los tipan; `rehidratarOrdenItem` reconstruye el
   bloque `desglosePrecio.descuento` (neto de lista = subtotal + monto) y setea
   `descuentoInput`. Editar un producto reaplica su descuento (el sheet de alta
   recotiza sin él).

Verificado: `tsc` front + API, `css:guard`, specs del motor (45). **Pendiente el
smoke test interactivo** (crear propuesta → aplicar descuento → ver resumen/detalle
→ emitir/rehidratar): bloqueado por login + Wati vivo en dev (emitir dispara
WhatsApps reales).

Desviaciones conscientes respecto del plan original:
- **Margen resultante**: en vez de un preview en vivo dentro del sheet (que
  duplicaría la matemática del motor), el sheet muestra el preview monetario y el
  aviso de margen bajo sale como toast al aplicar (umbral `DESCUENTO_MARGEN_ALERTA_PCT`
  = 15; el gate duro por umbral es F2).
- **Motivo**: no se implementó — la migración F1.3 no agregó columna. Sumar
  `descuentoMotivo` (migración aditiva + DTO + read) queda para un follow-up.

### F1.4 — texto original del handoff (referencia)

1. **Estado del descuento por item + de orden.** Guardar en el estado del item
   (o un `Map itemId→descuento`) `{ tipo, valor }`. El de orden se **prorratea a
   los items** por peso del neto de cada uno (para mandar cada `descuento` en el
   recotizar). Ojo el redondeo: el último item absorbe el residuo para cuadrar.
2. **Aplicar = recotizar.** Al setear/cambiar el descuento, re-cotizar el item
   (`recotizarCotizacionItem`, ya manda `descuento` por el tipo). El
   `desglosePrecio` vuelve descontado → `item.subtotal`, `getItemOrderVisibleAmounts`,
   `calcularCostoItem` ya lo reflejan sin tocar nada más.
3. **Sheet de descuento.** Botón "Descuento" junto a "Agregar cargo"
   (`propuesta-ficha.tsx` barra de acciones, ~línea 6620). Alcance (item/orden),
   tipo (%/$), valor, motivo. Preview del **margen resultante**
   (`desglosePrecio.descuento` + `margenEfectivoPct`) con warning si queda bajo.
4. **Mostrarlo.** Línea "Descuento −$X" en el resumen (`ResumenBar`, el `brk`) y
   en el desglose del item; "precio de lista → descontado" usando
   `desglosePrecio.descuento.netoListaTotal`.
5. **Emisión.** Mandar `descuentoTipo/Valor/Monto` por item en el payload de
   crear OT (el DTO ya los acepta). `descuentoMonto = desglosePrecio.descuento.montoTotal`.
6. **Rehidratar.** Al reabrir una OT/cotización, leer el descuento persistido
   (`CotizacionItem`/`OrdenTrabajoItem.descuento*`) — hoy la reconstrucción del
   snapshot en `propuesta-ficha.tsx` (~4619) entra en **no-op**; conectar ahí el
   descuento persistido. Requiere exponer los campos en el read de OT/cotización.

Decisiones ya confirmadas (defaults del §4): IVA sobre neto descontado ✓,
comisión sobre precio con descuento ✓, gate de margen (F3, después) ✓, un
descuento por eje ✓, sólo comercial (no cupón) en F1 ✓.

### ✅ F5 — Facturación coherente (implementado 2026-08-08)

Hallazgo del relevamiento: **los totales fiscales ya eran coherentes** (el
descuento viaja dentro de `OrdenTrabajoItem.subtotal`, y de ahí salen factura,
deuda y reportes). F5 no corrige plata: **expresa** el descuento en el
comprobante como bonificación. Decisión de producto (Lucas, 2026-08-08):
**factura detallada sólo cuando hay descuento**.

- **Helper puro** `invoicing/items-orden-descuento.ts` (+13 tests):
  - `itemsOrdenConDescuento(letra, items)`: renglón con precio de LISTA +
    `bonificacionPct` sin redondear (float) — bonificar devuelve la base
    persistida al centavo. El % es escala-libre: en A la base es el neto
    (`subtotal`), en B/C/E el precio final (`total` persistido — cierra exacto
    aunque el IVA no fuera 21%). El precio unitario NO se redondea (redondearlo
    × cantidades grandes desvía pesos enteros).
  - `renglonesDetalladosOrden(...)`: gate — descuento > 0 + factura del saldo
    COMPLETO y de una vez (tolerancia $0,50: el modal redondea el monto) + el
    recálculo cierra contra el saldo (±$0,05; si no, renglón único antes que
    desviar la deuda). Devuelve `null` → caller cae al renglón por monto.
- **`facturarOrden`** usa el gate; montos parciales y órdenes sin descuento
  siguen saliendo como renglón único ("Trabajos de impresión — OT-X").
- **`resolverReceptorEItems`** (Administración → "desde orden"): los auto-items
  expresan lista + bonificación con la misma base de siempre (subtotal).
- **Fix crítico en `afip-sdk.provider`**: el desglose de IVA de letra A armaba
  `BaseImp` desde los items IGNORANDO `bonificacionPct` → hubiera declarado
  base de lista contra un `ImpNeto` bonificado (rechazo ARCA). Ahora bonifica.
- **Render**: PDF (`factura-pdf.service`) con columna "Bonif." condicional y
  subtotal de línea bonificado (`factura.service.itemsDocumento`); detalle web
  (`comprobante-detalle-view`) idem con anotación en la descripción; el modal
  Facturar avisa cuando la factura va a salir detallada.
- **Deuda/reportes verificados**: el vínculo toma el total recalculado de las
  líneas (patrón existente); ventas del Panel leen `subtotal` ya descontado;
  la NC por monto no cambia.

### ✅ F2-restante — Cara al cliente (implementado 2026-08-08)

Los items de la emisión reusan `CrearOrdenTrabajoItemDto`, así que el
`emisionJson` ya traía el descuento gratis desde F1.4 — sólo faltaba mapearlo
en los consumidores. `descuentoDeItem()` en presupuestos.service expone
`descuentoMonto/descuentoPct/totalLista` (gross-up escala-libre, mismo criterio
que F5) + `descuentoTotal` agregado; presupuestos viejos sin los campos → `{}`.

- **PDF** (`presupuesto-pdf.service`): línea verde "Bonificación −10% · antes
  AR$ X" por renglón (medida en `medirItem`, misma familia visual que
  "Incluye:") + desglose "Subtotal de lista / Descuento (verde, signo afuera)
  / Subtotal con descuento" en los totales. Verificado visualmente con un PDF
  de muestra generado por spec descartable.
- **Página pública `/p/`**: lista tachada + badge verde −% por item, y el mismo
  desglose en los totales. En verde: para el cliente es un beneficio.
- **Vista staff del presupuesto**: lista neta tachada + badge −% en la columna
  Subtotal, y nota "con descuento −$X" en el resumen.
- **Tracking `/t/`: N/A** — no muestra montos por diseño (sólo progreso de
  producción); no hay descuento que mostrar.
- La conversión presupuesto→OT ya arrastraba el descuento (mismo DTO).

### ✅ F3 — Aprobación por umbral (implementado 2026-08-08)

Enchufado a la maquinaria de aprobación interna de presupuestos que ya existía
(evaluador puro + `pendiente_aprobacion` + permiso `comercial.aprobar_descuento`
+ `aprobacionMotivosJson`; OPERADOR bloqueado, SUPERVISOR/ADMIN exentos):

- `aprobacion.ts`: regla `descuento` — dispara si `descuentoMaxPct` (el mayor %
  entre las líneas, agregado del presupuesto) supera `aprobacionDescuentoMaxPct`.
  El igual pasa; null = desactivada. +4 tests.
- `evaluarReglas`: el % por línea sale del `emisionJson` (descuentoMonto /
  neto de lista, ambos en términos netos — exacto, sin asumir alícuota). No se
  zipea contra `CotizacionItem` (listas distintas); va como agregado.
- Config: `config()`/DTO/tipo front exponen `aprobacionDescuentoMaxPct` (la
  columna YA existía como placeholder — sin migración) + input "Descuento
  máximo (%)" en la config de Presupuestos.
- Ficha: al aplicar un descuento que supera el umbral del tenant, toast
  inmediato "va a requerir aprobación interna" (config buscada lazy y cacheada;
  el gate real vive en el backend al enviar).
- El motivo fluye a la UI existente como texto (sin cambios de render).

**Gate también en la OT directa** (decisión de Lucas, mismo día): un OPERADOR
no manda al taller un descuento sobre el umbral —
`exigirDescuentoEmitible` en ordenes-trabajo.service (+6 tests unitarios con
prisma fake). Cubre los tres caminos: emisión directa (`create` con
`pendiente`), emitir un borrador (`cambiarEstado` desde `borrador`), y el
bypass por API de agregar/editar items en una orden ya emitida (editar sólo
gatea si el % AUMENTA — reeditar specs con un descuento ya firmado no traba).
El BORRADOR nunca gatea (no viaja al taller). SUPERVISOR/ADMIN exentos. El
error del backend guía: borrador, presupuesto con aprobación, o supervisor.
No hay flujo de "aprobación de OT" — la aprobación formal vive en el circuito
de presupuestos; acá el supervisor simplemente la emite él.

### ✅ F4 — Cupones con alcance (implementado 2026-08-08)

Principio: **el cupón es una fuente AUTORIZADA del mismo descuento por línea
de F1** — validar un código devuelve qué líneas alcanza; la ficha lo
materializa con la maquinaria existente (`descuentoInput` + `cuponId`) y todo
el pipeline (PDF, factura, reportes) sale gratis. Decisiones de Lucas: ABM en
Comercial con **QR escaneable** (lector 2D tipea el código + Enter), cupón
**exento del gate** (crearlo ES autorizar), y **pisa al manual** con aviso.

- **Modelo** (migración `20260808200000_cupones_descuento`, aplicada a dev y
  test): `Cupon` (código único por tenant, %/$, alcance ORDEN/CATEGORIA/
  SUBCATEGORIA/PRODUCTO/CLIENTE por `alcanceRef` blando, montoMinimo,
  vigencia, usoMax/usoCount, activo) + `CuponRedencion` (@@unique
  cupon+orden) + `OrdenTrabajoItem.descuentoCuponId`.
- **API** `src/cupones/`: reglas PURAS en `cupon-reglas.ts` (+9 tests) —
  elegibilidad y líneas alcanzadas; CRUD (escribir = `comercial.
  aprobar_descuento` + SUPERVISOR/ADMIN); `POST /validar` (no redime);
  `GET /:id/qr` (dep `qrcode` ya presente por AFIP; QR = código plano).
- **Redención al emitir la OT** (decisión §4.6): `redimirCupones` en la MISMA
  transacción de emisión — UPDATE condicional atómico (activo + vigente +
  usos), estilo reserva del despachador de WhatsApp; carrera por el último
  uso → el segundo falla con motivo claro. Cubre emisión directa y
  borrador→emitida. **Cancelar libera** (`liberarCupones`: borra redención y
  decrementa con piso 0). El monto mínimo NO se re-chequea al emitir (se
  validó al aplicar; la orden pudo cambiar — consciente).
- **Exenciones del gate F3**: líneas con `descuentoCuponId` no cuentan para
  el umbral (emisión de OT y envío de presupuesto). Ojo: agregar/editar items
  en una orden YA emitida NO exime cupones (ahí no corre redención que los
  valide — conservador a propósito).
- **Ficha**: el modal de descuento (alcance orden) tiene modo **Cupón**:
  input con Enter-para-validar (lector 2D), preview (valor + a cuántas líneas
  alcanza), aplicar materializa por línea (% igual; $ prorrateado, residuo a
  la última) y avisa si pisó manual. `descuentoInput.cuponId/cuponCodigo`
  viaja por recotización → emisión → rehidratación.
- **Vista Comercial → Cupones** (`cupones-view.tsx` + módulo CSS): cards con
  estado/usos/vigencia, alta (SUPERVISOR/ADMIN), activar/desactivar, y
  **modal QR** con PNG descargable para imprimir.

Pendiente de verificación manual: alta de cupón + validar en ficha + emitir
(redime) + cancelar (libera). El API de la otra sesión debe reiniciarse para
levantar el módulo nuevo.

### Después de F1+F2+F3+F4+F5
F6 (cupón self-service en el link público del presupuesto). Menores:
`descuentoMotivo`, selector de alcance con búsqueda en el ABM (hoy se pega el
código/id a mano).
