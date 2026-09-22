import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { contratoSuscripcion } from '../suscripciones/contrato-suscripcion';
import { limitesContratacionPendiente } from '../suscripciones/contratacion-pendiente';

type Lectura = Pick<
  Prisma.TransactionClient,
  'tenant' | 'suscripcion' | 'archivo'
>;

/** Todas las transiciones que ocupan/liberan espacio toman este lock primero.
 * Se libera antes de transferir bytes al storage. */
export async function bloquearAlmacenamiento(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  const filas = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Tenant" WHERE id = ${tenantId}::uuid FOR UPDATE`;
  if (!filas.length) throw new NotFoundException('La empresa no existe.');
}

export async function cupoAlmacenamiento(
  db: Lectura,
  tenantId: string,
  excluirReserva?: string,
) {
  const [tenant, suscripcion, reservas] = await Promise.all([
    db.tenant.findUnique({
      where: { id: tenantId },
      select: { bytesArchivos: true, cuotaBytesArchivos: true },
    }),
    db.suscripcion.findFirst({
      where: { tenantId },
      include: { plan: true, planVersion: true },
    }),
    db.archivo.aggregate({
      where: {
        tenantId,
        estado: 'PENDIENTE',
        reservaHasta: { gt: new Date() },
        ...(excluirReserva ? { id: { not: excluirReserva } } : {}),
      },
      _sum: { bytesReservados: true },
      _count: { _all: true },
    }),
  ]);
  if (!tenant) throw new NotFoundException('La empresa no existe.');
  const contrato = contratoSuscripcion(suscripcion);
  const gb = contrato.limites.almacenamiento.gb;
  // Compatibilidad: en las cuentas anteriores cero significa sin ajuste/tope.
  const ajuste = tenant.cuotaBytesArchivos;
  const cuotaBytes =
    ajuste && ajuste > 0n
      ? ajuste
      : gb && gb > 0
        ? BigInt(Math.floor(gb * 1024 ** 3))
        : null;
  const origen =
    ajuste && ajuste > 0n
      ? ('ajuste' as const)
      : cuotaBytes === null
        ? ('sin_limite' as const)
        : ('plan' as const);
  return {
    bytes: tenant.bytesArchivos,
    bytesReservados: reservas._sum.bytesReservados ?? 0n,
    cargasPendientes: reservas._count._all,
    cuotaBytes,
    origen,
    plan: suscripcion?.plan ? { nombre: contrato.nombre, storageGb: gb } : null,
  };
}

/** Llamar bajo el lock y conservarlo hasta persistir la reserva/transición.
 * delta puede ser negativo al reemplazar un PDF por otro más pequeño. */
export async function exigirEspacio(
  tx: Prisma.TransactionClient,
  tenantId: string,
  delta: bigint,
  excluirReserva?: string,
) {
  const cupo = await cupoAlmacenamiento(tx, tenantId, excluirReserva);
  if (delta <= 0n) return;
  const pendiente = await limitesContratacionPendiente(tx, tenantId);
  // La excepción administrativa de espacio se conserva al cambiar de plan.
  const destino =
    cupo.origen === 'ajuste' ? cupo.cuotaBytes : (pendiente?.bytes ?? null);
  const cuotaBytes =
    cupo.cuotaBytes === null
      ? destino
      : destino === null
        ? cupo.cuotaBytes
        : cupo.cuotaBytes < destino
          ? cupo.cuotaBytes
          : destino;
  if (cuotaBytes === null) return;
  if (cupo.bytes + cupo.bytesReservados + delta > cuotaBytes) {
    const salida =
      cupo.origen === 'plan'
        ? 'Borrá archivos o pasate a un plan con más espacio.'
        : 'Borrá archivos o pedí que te amplíen el espacio.';
    throw new ForbiddenException({
      code: 'CUPO_ALMACENAMIENTO_AGOTADO',
      message:
        pendiente && cuotaBytes === destino && cupo.origen !== 'ajuste'
          ? 'El archivo supera el espacio del plan con contratación pendiente. Revisá el pago o liberá espacio antes de continuar. Las cargas en curso también reservan espacio.'
          : `No hay espacio disponible para guardar el archivo. Las cargas en curso también reservan espacio. ${salida}`,
      cuotaBytes: Number(cuotaBytes),
      bytes: Number(cupo.bytes),
      bytesReservados: Number(cupo.bytesReservados),
    });
  }
}
