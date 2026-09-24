import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Único orden de locks para todos los escritores de stock/reservas.
 * Si interviene una OT, su fila se bloquea antes que las variantes. */
export async function bloquearVariantesStock(
  tx: Prisma.TransactionClient,
  tenantId: string,
  variantes: string[],
) {
  for (const id of [...new Set(variantes)].sort())
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${tenantId}:${id}`}, 0))::text`;
}

export async function cantidadReservada(
  tx: Prisma.TransactionClient,
  tenantId: string,
  varianteId: string,
  ubicacionId: string,
) {
  const result = await tx.reservaMaterialOt.aggregate({
    where: {
      tenantId,
      ubicacionId,
      cantidad: { gt: 0 },
      necesidad: { tenantId, varianteId },
    },
    _sum: { cantidad: true },
  });
  return result._sum.cantidad ?? new Prisma.Decimal(0);
}

export async function exigirStockLibre(
  tx: Prisma.TransactionClient,
  tenantId: string,
  varianteId: string,
  ubicacionId: string,
  fisico: Prisma.Decimal.Value,
  salida: Prisma.Decimal.Value,
) {
  const reservado = await cantidadReservada(
    tx,
    tenantId,
    varianteId,
    ubicacionId,
  );
  if (reservado.gt(0) && new Prisma.Decimal(fisico).minus(salida).lt(reservado))
    throw new ConflictException(
      'El movimiento usaría stock reservado para una OT. Registrá su consumo desde Materiales o liberá primero la reserva.',
    );
}

export async function reservasPorSaldo(
  tx: Prisma.TransactionClient,
  tenantId: string,
  variantes: string[],
  excluirOrdenId?: string,
) {
  if (!variantes.length) return new Map<string, Prisma.Decimal>();
  const reservas = await tx.reservaMaterialOt.findMany({
    where: {
      tenantId,
      cantidad: { gt: 0 },
      necesidad: {
        tenantId,
        varianteId: { in: variantes },
        ...(excluirOrdenId ? { ordenId: { not: excluirOrdenId } } : {}),
      },
    },
    select: {
      cantidad: true,
      ubicacionId: true,
      necesidad: { select: { varianteId: true } },
    },
  });
  const map = new Map<string, Prisma.Decimal>();
  for (const r of reservas) {
    const key = `${r.necesidad.varianteId}:${r.ubicacionId}`;
    map.set(key, (map.get(key) ?? new Prisma.Decimal(0)).plus(r.cantidad));
  }
  return map;
}
