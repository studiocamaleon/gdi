# Facturación sobre órdenes y deuda comercial — diseño

**Fecha:** 2026-07-18 · **Estado:** IMPLEMENTADO (etapas A–G completas, verificado E2E en homologación ARCA)

> Hallazgos de la implementación (2026-07-18):
> - **Bug preexistente del tenant-guard**: `findUnique` con `select` parcial
>   (sin tenantId) descartaba filas PROPIAS (post-filtro contra undefined).
>   Fix: el guard inyecta tenantId al select para poder verificar; regresión
>   en `prisma/__tests__/tenant-guard.spec.ts`.
> - **Bug preexistente del provider AFIP** para letra B: mandaba
>   ImpNeto=total/ImpIVA=0 sin objeto Iva → rechazo 10070. Ante ARCA la B
>   discrimina internamente: fix usa el desglose de totales-comprobante
>   (nuevo campo `ivaPorAlicuota` en el input del provider).
> - En la cta. cte., el saldo incluye TODOS los cobros del cliente (una seña
>   sobre una orden en producción baja el saldo de cuenta) mientras deudores
>   muestra sólo deuda exigible por orden — asimetría deliberada.

## 1. El problema conceptual

Hoy el sistema define deuda como *comprobante emitido con saldo pendiente*
(`cuenta-corriente.service.ts`). Consecuencia: una orden entregada y no
facturada **no existe como deuda** — no aparece en deudores, no envejece,
no está en la cta. cte. Eso no refleja la realidad argentina, donde no
toda venta se factura y donde la factura muchas veces llega antes o
después del pago, en cualquier orden.

**Decisión de fondo:** la deuda nace de la **venta** (la orden de
trabajo), no del papel fiscal. "Facturado" pasa a ser un **atributo** de
la orden — un eje independiente del eje de cobranza:

| Eje | Estados derivados | Fuente |
|---|---|---|
| **Cobranza** | sin cobrar / parcial / cobrada | cobros de la orden |
| **Fiscal** | sin facturar / parcial / facturada | facturas vinculadas |

Cualquier combinación es válida: adeudada sin facturar, cobrada sin
facturar, facturada sin cobrar, todo parcial, etc.

## 2. Decisiones tomadas (conversación 2026-07-18)

1. **Factura ↔ orden es muchos-a-muchos con monto**: N facturas pueden
   cubrir 1 orden (parciales) y 1 factura puede cubrir N órdenes (lote,
   un renglón por orden).
2. **Facturación parcial**: sí. El monto se elige con atajos ("100% del
   saldo", "50%", monto libre) y el concepto del renglón es texto libre
   con sugerencia (`Trabajos de impresión — OT-2026-0184`).
3. **La deuda comercial nace en "Finalizada"**. Aging comercial = saldo
   sin cobrar desde la fecha de finalización en adelante. (Plazos de
   cta. cte. por cliente: fase posterior; por ahora no hay plazo — la
   deuda es exigible al finalizar.)
4. **Sólo se facturan OTs** desde el sistema. No hay comprobantes
   sueltos nuevos (los históricos sin orden quedan como están).
5. **Cobro → una orden** (sin split de un cobro entre órdenes, por ahora).
6. **Imputación cobro→factura automática y bidireccional** (FIFO). El
   usuario nunca imputa a mano; el estado fiscal es vista secundaria.
7. **Deudores y cta. cte. pivotean a deuda comercial** como vista
   principal; lo facturado es columna/dato secundario.
8. **UI**: acción "Facturar" en la ficha de la orden (no en el listado
   de OTs); vista nueva **Administración → Facturación** para el lote;
   tab **"Comprobantes asociados"** en la ficha de la orden.
9. **Tope duro**: no se puede facturar más que el total de la orden.
10. **Orden sin cliente**: facturable como Consumidor Final (B/C). Para
    factura A hay que asignarle cliente con CUIT primero.
11. **Lote**: órdenes del mismo cliente → elegir "una factura por orden"
    o "agrupar en una"; distintos clientes → sólo una por orden.
12. **Recibo interno por cobro** (para mandar por WhatsApp): futuro.
    Por ahora sólo facturas.

**Pospuesto explícitamente:** plazos/condición de venta por cliente,
señas exigibles, quitas/incobrables (ajuste de deuda sin cobro), recibo
interno, integración WhatsApp. Las NC ya existen fiscalmente; su efecto
sobre el facturado de la orden se define en §7.6.

## 3. Modelo de datos

### 3.1 Nueva tabla `ComprobanteOrden`

Reemplaza al `Comprobante.ordenId` único.

```prisma
/// Aplica (parte de) un comprobante a una orden. Un comprobante puede
/// cubrir varias órdenes (lote) y una orden puede recibir varios
/// comprobantes (parciales). `monto` es TOTAL (IVA incluido), en la
/// misma moneda del comprobante.
model ComprobanteOrden {
  id            String       @id @default(uuid()) @db.Uuid
  tenantId      String       @db.Uuid
  comprobanteId String       @db.Uuid
  ordenId       String       @db.Uuid
  monto         Decimal      @db.Decimal(14, 2)
  createdAt     DateTime     @default(now())

  tenant        Tenant       @relation(...)
  comprobante   Comprobante  @relation(...)
  orden         OrdenTrabajo @relation(...)

  @@unique([comprobanteId, ordenId])
  @@index([tenantId, ordenId])
}
```

- `Comprobante.ordenId` se **deprecia**: migración crea un
  `ComprobanteOrden` por cada comprobante existente con `ordenId`, con
  `monto = comprobante.total`. Después se elimina la columna (mismo
  patrón de dos pasos usado en migraciones anteriores).
- Invariante: `SUM(monto)` de las órdenes de un comprobante `=`
  `comprobante.total` (el comprobante se reparte completo).

### 3.2 `OrdenTrabajo` — campos nuevos

```prisma
/// Primera vez que la orden llegó a 'finalizada'. Ancla del aging
/// comercial. Se setea en la transición a finalizada (si es null);
/// reabrir a producción NO la borra, pero la orden sale de deudores
/// porque el filtro es por estado.
fechaFinalizada  DateTime?

/// Denormalizados, mantenidos en la misma transacción que los
/// movimientos (mismo patrón que Comprobante.saldoPendiente):
/// SUM(ComprobanteOrden.monto) de comprobantes tipo factura EMITIDOS
/// no anulados, y SUM(Cobro.montoBruto) no anulados de la orden.
facturadoTotal   Decimal @default(0) @db.Decimal(14, 2)
cobradoTotal     Decimal @default(0) @db.Decimal(14, 2)
```

El cobro entra por su **bruto** (lo que el cliente entregó), coherente
con la convención existente de la cta. cte.: la comisión del método es
costo nuestro, vive en tesorería.

### 3.3 Sin cambios

- `Cobro`: sigue con `ordenId` único opcional.
- `CobroImputacion`: misma tabla, pero pasa a ser **gestionada por el
  sistema** (ver §5). La UI de imputación manual se retira.
- `Comprobante`: conserva `saldoPendiente` (saldo fiscal), numeración,
  CAE, idempotencia — todo el circuito de emisión ARCA queda intacto.

## 4. Estados derivados y definiciones

Con `T = total`, `F = facturadoTotal`, `C = cobradoTotal`, tolerancia
de redondeo `ε = 0.01`:

- **Fiscal**: `sin_facturar` (F ≈ 0) · `parcial` (0 < F < T − ε) ·
  `facturada` (F ≥ T − ε).
- **Cobranza**: `sin_cobrar` (C ≈ 0) · `parcial` (0 < C < T − ε) ·
  `cobrada` (C ≥ T − ε).
- **Deuda comercial de una orden**: `max(0, T − C)` si
  `estado ∈ {finalizada, entregada}`; si no, 0 (una seña sobre una
  orden en producción no es deuda todavía, pero sí cuenta como cobro).
- **Saldo sin facturar** (para el tope y la vista Facturación):
  `max(0, T − F)`.
- **Aging comercial**: días desde `fechaFinalizada` hasta hoy, sobre la
  deuda comercial. Tramos existentes de `aging.ts` reutilizados; el
  tramo "a_vencer" queda vacío mientras no existan plazos (todo lo
  finalizado ya es exigible).

## 5. Imputación automática cobro→factura (bidireccional, FIFO)

La realidad: a veces factura primero y pago después; a veces al revés.
El matching corre en ambos gatillos, siempre dentro de la misma orden:

**Al registrar un cobro** con `ordenId`:
1. Buscar facturas de la orden (`ComprobanteOrden`) con
   `estado = 'emitido'` y `saldoPendiente > 0`, orden `fecha ASC`.
2. Aplicar el bruto del cobro contra cada una (crear `CobroImputacion`,
   descontar `saldoPendiente`) hasta agotar cobro o facturas.
3. El remanente del cobro queda libre (a cuenta de la orden).

**Al emitir una factura** vinculada a órdenes:
1. Por cada orden de la factura: buscar cobros de esa orden no anulados
   con remanente libre (`montoBruto − SUM(imputaciones del cobro)`),
   orden `fecha ASC`.
2. Aplicar contra la factura hasta cubrir `min(monto de la orden en la
   factura, saldoPendiente)`.

**Reversas** (misma transacción):
- Anular cobro → borrar sus imputaciones, restaurar `saldoPendiente` de
  las facturas afectadas, recalcular `cobradoTotal`.
- Anular factura → borrar sus imputaciones (los cobros quedan libres),
  restaurar `facturadoTotal`, y **re-correr el matching** de esos cobros
  liberados contra otras facturas impagas de la orden.

Todo dentro de una transacción Prisma con los denormalizados
(`saldoPendiente`, `facturadoTotal`, `cobradoTotal`) actualizados
atómicamente — mismo patrón que hoy usa `imputaciones.service.ts`.

## 6. Flujos de UI

### 6.1 Facturar desde la ficha de la orden

- Botón **"Facturar"** junto a las acciones actuales de la ficha.
  Visible si `estado ∉ {borrador}` y `saldo sin facturar > 0`.
- Sheet/modal con:
  - **Monto**: atajos `[100% del saldo] [50%] [Monto libre]` — siempre
    validado contra el saldo sin facturar (tope duro §2.9).
  - **Concepto**: texto libre, precargado
    `Trabajos de impresión — {numero}`.
  - **Receptor**: el cliente de la orden (con su condición fiscal →
    letra, punto de venta según config existente). Sin cliente →
    Consumidor Final; si se quiere A, primero asignar cliente con CUIT.
  - Vista previa de neto/IVA/total (lógica existente de
    `factura.service.ts` — IVA por fuera sobre neto, según revisión de
    impuestos 2026-07-08; del monto total elegido se deriva el neto).
- Emite por el circuito actual (borrador → CAE → emitido) y crea el
  `ComprobanteOrden` + matching §5.

### 6.2 Vista nueva: Administración → Facturación

- Lista **órdenes en `finalizada`/`entregada` con saldo sin facturar
  > 0** (server-driven, mismo patrón del listado de OTs). Columnas:
  orden, cliente, fecha finalización, total, facturado, saldo sin
  facturar, cobrado.
- Filtros: cliente, rango de fechas, búsqueda.
- Selección múltiple →
  - mismo cliente: elegir **"una factura por orden"** o **"agrupar en
    una"** (un renglón por orden: concepto sugerido con el número de
    cada OT, monto = saldo sin facturar de cada una, editable).
  - distintos clientes: sólo "una factura por orden".
- Emisión en lote **secuencial** (el CAE es por comprobante): progreso
  visible, y al final reporte de resultado por orden — las que fallaron
  (rechazo ARCA, timeout) quedan listadas con el error, las demás
  emitidas. Nunca todo-o-nada: cada factura es su propia transacción.

### 6.3 Ficha de la orden: tab "Comprobantes asociados"

- Nuevo tab en la ficha (junto a los existentes) con dos bloques:
  - **Fiscales**: facturas/NC/ND vinculadas — tipo+letra+número, fecha,
    monto aplicado a esta orden, estado (emitido/rechazado/anulado),
    CAE, acceso al PDF.
  - **Cobros**: los cobros de la orden — fecha, método, bruto, estado
    de acreditación. (Cuando exista el recibo interno, se genera desde
    acá; por ahora es listado.)
- Cabecera del tab: los dos chips derivados (fiscal y cobranza) +
  barras de avance facturado/cobrado sobre el total.
- En el **listado** de OTs estos estados NO se muestran (decisión F1:
  el taller no necesita ver qué orden está facturada o no).

### 6.4 Deudores y cuenta corriente (pivot)

- **Deudores**: la matriz pasa a leer **órdenes** (`finalizada`/
  `entregada`, deuda comercial > 0, con cliente). Aging desde
  `fechaFinalizada`. Columna secundaria "facturado %" por cliente.
  Órdenes sin cliente con deuda: fila "Mostrador / sin cliente"
  (sin cta. cte. navegable).
- **Cta. cte. de un cliente**: el ledger pivotea — DEBE = orden
  finalizada (por su total, a `fechaFinalizada`), HABER = cobros (por
  bruto). Los comprobantes fiscales dejan de ser renglones del ledger y
  pasan a información secundaria (columna "facturado" en el renglón de
  la orden, o detalle expandible).
- **Reportes de cobranza** (DSO, alertas de deuda vencida): cambian de
  fuente — de `Comprobante.saldoPendiente/vencimiento` a deuda
  comercial/`fechaFinalizada`. La semántica de los KPIs se conserva.
- Los reportes comerciales del Panel **no cambian** (ya son
  orden-céntricos: `ventas.service.ts` lee `OrdenTrabajoItem`).

## 7. Casos borde

1. **Cobro antes de finalizada (seña)**: cuenta en `cobradoTotal` y en
   el matching futuro; no es deuda hasta finalizar. Si al finalizar
   `C ≥ T`, la orden nace cobrada y nunca pisa deudores.
2. **Cobro mayor al saldo**: se permite con aviso (no bloqueo — pasa en
   la realidad); la deuda comercial tiene piso 0.
3. **Orden reabierta** (finalizada → producción, vía `reabrir` de
   pasos): sale de deudores por el filtro de estado. `fechaFinalizada`
   se conserva (primera finalización) para no resetear el aging si
   vuelve a finalizar. Las facturas ya emitidas quedan válidas.
4. **Edición de la orden después de facturar**: no se permite dejar
   `total < facturadoTotal` — validación al editar, con mensaje que
   indique anular factura o emitir NC primero.
5. **Factura rechazada por ARCA**: no cuenta en `facturadoTotal` (sólo
   `emitido` cuenta). Los borradores tampoco cuentan ni reservan cupo:
   el tope se valida al emitir.
6. **Notas de crédito**: una NC emitida vinculada a la orden **resta**
   de `facturadoTotal` (libera cupo para refacturar). El flujo de UI
   para emitir NC desde la orden puede ir después, pero el modelo la
   contempla desde el día uno (ComprobanteOrden admite tipo NC con
   idéntica mecánica, signo negativo en el agregado).
7. **Comprobantes históricos sin orden**: quedan como están; siguen
   visibles en Administración → Comprobantes. No entran en la deuda
   comercial (no tienen orden) — se asume que sus órdenes “de facto” ya
   están saldadas o no existen en el sistema.
8. **Moneda**: comprobantes en ARS (hoy único caso real). Si el
   comprobante fuera en otra moneda, `ComprobanteOrden.monto` va en la
   moneda del comprobante y el agregado exige conversión — fuera de
   alcance, se bloquea facturar orden en moneda ≠ comprobante.

## 8. Etapas de implementación

- **A. Schema + migración**: `ComprobanteOrden`, campos nuevos en
  `OrdenTrabajo`, migración de `Comprobante.ordenId` → junction,
  backfill de `fechaFinalizada` (desde `OrdenTrabajoEvento` tipo
  'estado' → finalizada; fallback `updatedAt`), backfill de
  `facturadoTotal`/`cobradoTotal`.
- **B. Motor**: servicio de vínculo factura↔orden con tope, matching
  bidireccional FIFO + reversas, recálculo transaccional de
  denormalizados. Tests unitarios de los 8 casos borde.
- **C. Facturar desde la orden**: endpoint (orden + monto + concepto →
  borrador vinculado → emitir), sheet en la ficha, atajos de monto.
- **D. Tab "Comprobantes asociados"** en la ficha con chips y barras.
- **E. Vista Administración → Facturación** con lote (agrupar/por
  orden), emisión secuencial y reporte de resultado.
- **F. Pivot deudores/cta. cte./reportes de cobranza** a deuda
  comercial + aging por `fechaFinalizada`.
- **G. Verificación E2E** con la DB de dev (tests API con
  `gdi_saas_test` aislada, según convención).

Cada etapa deja el sistema funcionando: A–B no cambian comportamiento
visible; C–E agregan; F pivotea las vistas al final, cuando los datos
ya están poblados.
