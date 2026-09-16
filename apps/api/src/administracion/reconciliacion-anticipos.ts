import { Prisma } from '@prisma/client';
import { FacturacionOrdenesService } from './facturacion-ordenes.service';
import { redondearSaldo as r2, saldoComercialCobro } from './saldo-comercial';

/** Reparación explícita de datos anteriores al control de doble aplicación.
 * Preserva los recibos y sus imputaciones fiscales; sólo retira la porción
 * comercial que excede el dinero disponible y vuelve a aplicar anticipos reales.
 * Debe ejecutarse en una transacción y con respaldo previo (ver scripts). */
export async function reconciliarAnticiposHistoricos(
  tx: Prisma.TransactionClient,
  motor: FacturacionOrdenesService,
  tenantId: string,
  clienteId: string,
) {
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM "Cobro"
    WHERE "tenantId" = ${tenantId}::uuid AND "clienteId" = ${clienteId}::uuid
      AND "ordenId" IS NULL AND "anuladoEl" IS NULL
    ORDER BY "fecha", "createdAt", "id" FOR UPDATE
  `);
  const cobros = await tx.cobro.findMany({
    where: { tenantId, clienteId, ordenId: null, anuladoEl: null },
    include: {
      aplicacionesOrden: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    },
  });
  const correcciones: Array<{
    cobroId: string;
    ordenId: string;
    anterior: number;
    corregido: number;
  }> = [];
  for (const cobro of cobros) {
    const saldo = await saldoComercialCobro(tx, tenantId, cobro.id);
    let disponible = Math.max(0, r2(saldo.bruto - saldo.enHistoricos));
    for (const aplicacion of cobro.aplicacionesOrden) {
      const anterior = Number(aplicacion.monto);
      const corregido = Math.min(anterior, disponible);
      disponible = r2(disponible - corregido);
      if (corregido === anterior) continue;
      const cambio = {
        cobroId: cobro.id,
        ordenId: aplicacion.ordenId,
        anterior,
        corregido,
      };
      correcciones.push(cambio);
      if (corregido === 0) {
        await tx.cobroOrden.delete({ where: { id: aplicacion.id } });
      } else {
        await tx.cobroOrden.update({
          where: { id: aplicacion.id },
          data: { monto: corregido },
        });
      }
      await tx.ordenTrabajoEvento.create({
        data: {
          tenantId,
          ordenId: aplicacion.ordenId,
          tipo: 'nota',
          origen: 'sistema',
          usuarioNombre: 'Sistema',
          descripcion: `Corrección de anticipo ${cobro.numeroRecibo ?? ''}: $${r2(anterior - corregido).toLocaleString('es-AR', { minimumFractionDigits: 2 })} ya estaban aplicados a comprobantes históricos. Se conserva el recibo original.`,
          datosJson: { accion: 'correccion_anticipo_historico', ...cambio },
        },
      });
    }
  }
  if (correcciones.length === 0) return correcciones;
  for (const ordenId of new Set(correcciones.map((c) => c.ordenId))) {
    await motor.recalcularCobrado(tx, tenantId, ordenId);
  }
  const ordenes = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "OrdenTrabajo"
    WHERE "tenantId" = ${tenantId}::uuid AND "clienteId" = ${clienteId}::uuid
      AND "estado" IN ('finalizada', 'entregada')
    ORDER BY COALESCE("fechaVencimientoComercial", "fechaFinalizada"::date), "fechaFinalizada", "createdAt", "id"
    FOR UPDATE
  `);
  for (const orden of ordenes) {
    await motor.aplicarAnticiposClienteAOrden(tx, tenantId, orden.id);
  }
  return correcciones;
}
