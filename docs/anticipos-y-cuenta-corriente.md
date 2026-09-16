# Anticipos y cuenta corriente

## Reglas vigentes

- El cargo comercial nace al emitir una OT: estados pendiente, producción, finalizada y entregada. Borradores y canceladas quedan fuera. Su pendiente es `max(0, total - cobradoTotal)`.
- El vencimiento es independiente del cargo: se fija al finalizar, respetando el plazo del cliente. Sin fecha de vencimiento, el pendiente se muestra en «A vencer»; no se considera atrasado. Reabrir conserva la fecha de emisión y el vencimiento ya fijado.
- Un cobro directo queda reservado a su OT. Un cobro general del cliente se distribuye entre OTs finalizadas/entregadas con deuda, por vencimiento comercial, fecha de finalización y creación. El excedente queda como anticipo.
- Al finalizar una OT, los anticipos generales disponibles se aplican por fecha del cobro y creación. Cada aplicación queda en `CobroOrden` y en el historial de la OT. Repetir la operación no duplica importes.
- Disponible comercial de un cobro general = bruto menos aplicaciones a OTs menos imputaciones a facturas/ND históricas vigentes sin OT. Las notas heredan el vínculo de su comprobante de origen para distinguir ventas históricas.
- Una factura vinculada a una OT documenta la misma venta: no vuelve a consumir el saldo comercial ni genera otro DEBE en cuenta corriente. El matching fiscal mantiene su circuito independiente; los históricos sólo pueden consumir dinero comercialmente libre. El endpoint manual respeta el mismo límite.
- Se usa el bruto: comisiones y retenciones no disminuyen lo que pagó el cliente. La acreditación en Tesorería es un eje distinto de la aplicación comercial. La anulación de un cobro revierte sus efectos y conserva el historial.
- La cuenta corriente incluye OTs emitidas vigentes, facturas y ND históricas sin OT, NC históricas y cobros vigentes. Así los pagos de ventas históricas no aparentan ser anticipos libres.
- Cuentas por cobrar muestra los pendientes por OT y por comprobante histórico, agrupados por cliente. Las OTs usan su vencimiento comercial; los históricos, su vencimiento o fecha. Una venta nunca aparece dos veces por tener factura.
- El saldo global del cliente y el anticipo disponible no son equivalentes: pueden coexistir cargos pendientes y cobros generales todavía sin aplicar. Las aplicaciones comerciales y fiscales conservan sus reglas; consultar el extracto no modifica cobros ni redistribuye dinero.

## Presentación en una OT

`GET /administracion/cobros?ordenId=…` incluye cobros directos y aplicaciones de cobros generales. `montoBruto` sigue siendo el total original del recibo; `montoAplicadoOrden` es lo que cubre esa OT. La consulta por OT no se trunca a 200 recibos.

Pagos y Comprobantes suman sólo la porción aplicada. Pagos identifica los recibos de cuenta corriente; las comisiones, retenciones y cifras netas del recibo se muestran proporcionales a esa porción. El PDF del recibo conserva su importe completo. La anulación desde la OT afecta al recibo entero, y la confirmación lo aclara.

Un error al consultar cobros se muestra como error, no como una lista vacía ni un saldo inventado de cero pagos.

## Resumen de la cuenta corriente

La vista y el encabezado del PDF muestran **Saldo total** (`saldo`, con el signo invertido para coincidir con la tabla) y **Saldo vencido** (la suma de los cuatro tramos vencidos, excluyendo «A vencer», también con signo negativo cuando hay deuda). El total es el neto de cargos menos pagos y créditos; el vencido considera los pendientes que ya pasaron su fecha límite. Se conservan los centavos. Un saldo cero o a favor no oculta el detalle de vencimientos si todavía hay pagos sin aplicar.

El detalle de vencimientos conserva el total pendiente por orden/comprobante (`agingTotal`) y su distribución en los cinco tramos. `anticipoDisponible` sigue siendo el dato operativo de fondos sin aplicar en la API, pero ya no es una card del resumen.

La tabla y el PDF usan **Cargos | Pagos y créditos | Saldo**, desde la perspectiva del cliente: cargos negativos en rojo, pagos y créditos positivos en verde. El saldo acumulado negativo significa deuda; positivo, saldo a favor; cero, al día. Las condiciones de crédito se consultan en un apartado desplegable.

Cada OT emitida vigente tiene un solo cargo con su total actual, fechado por `fechaEmision`. Para datos antiguos sin ese campo se usa el primer evento de emisión y, si tampoco existe, `createdAt`; nunca la fecha de consulta. Editar el total actualiza ese mismo cargo. Finalizar, entregar o reabrir no lo duplica ni cambia su fecha. Las canceladas dejan de aportar el cargo; sus cobros reales permanecen registrados. Anular un cobro retira ese pago y vuelve a dejar pendiente el cargo vigente.

Se eliminaron las filas virtuales de reserva y los campos `saldoConReservas` y `anticiposReservados`. Una OT de $35.086,21 totalmente pagada muestra cargo −$35.086,21 y cobro +$35.086,21: efecto neto $0, incluso antes de finalizarla. La API entrega `saldo` y el acumulado de cada fila con deuda positiva; UI y PDF invierten el signo.

El resumen y Cuentas por cobrar incluyen también los pendientes de OTs en curso. `sinVencimiento` identifica la parte de «A vencer» todavía sin fecha comercial; el detalle web y el PDF lo explican. El vencimiento de una OT no se calcula desde su emisión ni desde su fecha de entrega prometida.

## Reparación de datos previos

El defecto anterior permitía volver a usar recibos pagados a facturas históricas para cubrir OTs. También omitía esos históricos en el DEBE de la cuenta corriente y las aplicaciones generales en Pagos de la OT.

`apps/api/scripts/reconciliar-anticipos-historicos.ts` requiere tenant y cliente explícitos. Por defecto simula y revierte la transacción. Para aplicar exige una ruta de respaldo nueva, escrita con permisos privados antes del cambio. Mantiene recibos, movimientos de fondos e imputaciones fiscales; retira sólo aplicaciones comerciales excedidas, recalcula, reaplica anticipos reales e incorpora eventos de auditoría. Reconcilia además fidelización de las órdenes involucradas. Una segunda ejecución sin inconsistencias no cambia aplicaciones.

Desde `apps/api`:

```sh
node --env-file=.env -r ts-node/register scripts/reconciliar-anticipos-historicos.ts --tenant UUID --cliente UUID
# Agregar --aplicar --respaldo /ruta/nueva.json para confirmar el resultado revisado.
```

## Validación

Los tests de `anticipos-cuenta-corriente.spec.ts` usan fixtures propios en `gdi_saas_test`: históricos pagados y parciales, anticipos reales, FIFO, facturas de la misma OT, consulta de cobros por OT, aislamiento de tenant, bloqueo de imputaciones duplicadas, legacy directo, redondeo de centavos, anulaciones, NC/ND históricas, concurrencia y reparación idempotente. `cobro-aplicado.test.ts` verifica importes y prorrateo en la interfaz.
