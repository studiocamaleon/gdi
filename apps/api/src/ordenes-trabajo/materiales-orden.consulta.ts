import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { calcularMaterialesOrden } from './materiales-orden';

export async function leerMaterialesOrden(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ordenId: string,
) {
  const orden = await tx.ordenTrabajo.findFirst({
    where: { tenantId, id: ordenId },
    select: {
      id: true,
      estado: true,
      materialesControlados: true,
      materialesRevision: true,
      items: {
        where: { tenantId },
        orderBy: [{ ordenIndice: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          nombre: true,
          parentItemId: true,
          componenteCodigo: true,
          contieneLotesEntrega: true,
          trazabilidadSnapshotJson: true,
          jobContextSnapshotJson: true,
          cotizacionItem: {
            select: { trazabilidadJson: true, jobContextJson: true },
          },
          pasos: {
            where: { tenantId },
            orderBy: [{ indice: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              nombre: true,
              rutaPasoId: true,
              nestingLoteId: true,
              nestingLoteRol: true,
              nestingLoteSnapshotJson: true,
            },
          },
        },
      },
    },
  });
  if (!orden) throw new NotFoundException('Orden de trabajo no encontrada.');
  return { orden, materiales: calcularMaterialesOrden(orden.id, orden.items) };
}
