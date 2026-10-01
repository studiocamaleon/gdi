import { NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/** Decisión exclusiva del servidor. Una OT emitida conserva su modo original. */
export async function inicioSinStock(
  db: Prisma.TransactionClient,
  tenantId: string,
  ordenId?: string,
): Promise<boolean> {
  if (ordenId) {
    const orden = await db.ordenTrabajo.findFirst({
      where: { id: ordenId, tenantId },
      select: { estado: true, materialesInicioSinStock: true },
    });
    if (!orden) throw new NotFoundException('Orden de trabajo no encontrada.');
    if (orden.estado !== 'borrador') return orden.materialesInicioSinStock;
  }
  const politica = await db.politicaReservasMaterial.findUnique({
    where: { tenantId },
  });
  return politica?.inicioSinStock === true;
}

export const DETALLE_INICIO_SIN_STOCK =
  'Modo de inicio: disponibilidad de materiales sin verificar. No registra reservas ni consumos.';
