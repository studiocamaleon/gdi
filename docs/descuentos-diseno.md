# Descuentos — diseño

Estado: **F1 backend implementado y testeado; falta F1.4 (front UI).**
Rama `feat/descuentos`. Ver §10 para el estado de implementación y el handoff.

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

### ⏳ F1.4 — Front UI (PENDIENTE — la parte a probar en el browser)

Todo en `src/components/comercial/propuesta-ficha.tsx` (+ helpers).

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

### Después de F1
F2 (aprobación por umbral, `aprobacionDescuentoMaxPct`), F3 (cupones), F4
(facturación: mapear a `bonificacionPct` del comprobante), F5 (self-service).
