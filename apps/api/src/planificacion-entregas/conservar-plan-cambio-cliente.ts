import type { Prisma } from '@prisma/client';
import { huellaPlan } from './planificacion-contrato';

/** La edición exclusiva de datos comerciales no modifica la fuente productiva.
 * Revalida la huella anterior antes de avanzar su versión, sin renovar el ETA. */
export async function conservarPlanCambioCliente(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ordenId: string,
  versionAnterior: Date,
) {
  const orden = await tx.ordenTrabajo.findFirstOrThrow({
    where: { id: ordenId, tenantId },
    select: {
      updatedAt: true,
      estado: true,
      items: {
        where: { parentItemId: null, planEntrega: { isNot: null } },
        select: {
          id: true,
          cantidad: true,
          recetaRevisionId: true,
          recetaHuella: true,
          cotizacionItem: {
            select: {
              id: true,
              updatedAt: true,
              recetaRevisionId: true,
              recetaHuella: true,
            },
          },
          planEntrega: {
            select: {
              revisionActual: true,
              revisiones: {
                orderBy: { numero: 'desc' },
                take: 1,
                select: { id: true, origenHuella: true, numero: true },
              },
            },
          },
        },
      },
    },
  });
  for (const item of orden.items) {
    const c = item.cotizacionItem;
    const r = item.planEntrega?.revisiones[0];
    if (!c || !r || r.numero !== item.planEntrega?.revisionActual) continue;
    const fuente = {
      itemId: item.id,
      cantidad: Number(item.cantidad),
      cotizacionId: c.id,
      cotizacionVersion: c.updatedAt,
      recetaRevisionId: item.recetaRevisionId ?? c.recetaRevisionId,
      recetaHuella: item.recetaHuella ?? c.recetaHuella,
      estado: orden.estado,
    };
    await tx.planEntregaRevision.updateMany({
      where: {
        id: r.id,
        tenantId,
        origenHuella: huellaPlan({ ...fuente, ordenVersion: versionAnterior }),
      },
      data: {
        origenHuella: huellaPlan({ ...fuente, ordenVersion: orden.updatedAt }),
      },
    });
  }
}
