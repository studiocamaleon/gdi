import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { limitesContratacionPendiente } from './contratacion-pendiente';
import {
  contratoSuscripcion,
  type VersionContrato,
} from './contrato-suscripcion';

type Lectura = Pick<
  Prisma.TransactionClient,
  'suscripcion' | 'membership' | 'invitation'
>;
const normalizar = (email: string) => email.trim().toLowerCase();

export function limiteUsuarios(
  plan: { featuresJson: unknown } | null,
  adicionales = 0,
  planVersion: VersionContrato | null = null,
) {
  const incluidos = contratoSuscripcion(plan ? { plan, planVersion } : null)
    .limites.usuariosMax;
  return {
    incluidos,
    adicionales,
    limite: incluidos === null ? null : incluidos + adicionales,
  };
}

/** Toda escritura de accesos, cupos y contrato toma este lock ANTES de leer.
 * Con READ COMMITTED, la siguiente alta ve lo que confirmó la anterior.
 * La actualización sin cambio de valor toma NO KEY UPDATE y deja una versión
 * MVCC. Así una transacción SERIALIZABLE que esperaba con una foto anterior
 * debe reintentarse; un SELECT con lock por sí solo no renueva esa foto.
 * No cambia updatedAt ni bloquea los KEY SHARE de relaciones foráneas. */
export async function bloquearCupoUsuarios(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  const filas = await tx.$queryRaw<Array<{ id: string }>>`
    UPDATE "Tenant" SET "updatedAt" = "updatedAt"
    WHERE id = ${tenantId}::uuid RETURNING id`;
  if (!filas.length) throw new NotFoundException('La empresa no existe.');
}

export async function ocupacionUsuarios(db: Lectura, tenantId: string) {
  const [miembros, invitaciones] = await Promise.all([
    db.membership.findMany({
      where: { tenantId, activa: true },
      select: { userId: true, user: { select: { email: true } } },
    }),
    db.invitation.findMany({
      where: {
        tenantId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true, email: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  const idsActivos = new Set(miembros.map((m) => m.userId));
  const correosActivos = new Set(miembros.map((m) => normalizar(m.user.email)));
  const correosPendientes = new Set<string>();
  const idsPendientes = new Set<string>();
  const pendientes = invitaciones.filter((i) => {
    const email = normalizar(i.email);
    if (
      correosActivos.has(email) ||
      (i.userId && idsActivos.has(i.userId)) ||
      correosPendientes.has(email) ||
      (i.userId && idsPendientes.has(i.userId))
    )
      return false;
    correosPendientes.add(email);
    if (i.userId) idsPendientes.add(i.userId);
    return true;
  });
  return {
    activos: miembros.length,
    pendientes,
    idsActivos,
    correosActivos,
    idsPendientes,
    correosPendientes,
  };
}

export async function resumenCupoUsuarios(db: Lectura, tenantId: string) {
  const [suscripcion, ocupacion] = await Promise.all([
    db.suscripcion.findFirst({
      where: { tenantId },
      include: { plan: true, planVersion: true },
    }),
    ocupacionUsuarios(db, tenantId),
  ]);
  const limites = limiteUsuarios(
    suscripcion?.plan ?? null,
    suscripcion?.usuariosAdicionales ?? 0,
    suscripcion?.planVersion,
  );
  const ocupados = ocupacion.activos + ocupacion.pendientes.length;
  return {
    ...limites,
    activos: ocupacion.activos,
    invitacionesPendientes: ocupacion.pendientes.length,
    ocupados,
    disponibles:
      limites.limite === null ? null : Math.max(0, limites.limite - ocupados),
    excedidos:
      limites.limite === null ? 0 : Math.max(0, ocupados - limites.limite),
  };
}

/** El caller conserva el lock hasta guardar el acceso o la invitación.
 * Aceptar una invitación sustituye su reserva, no suma otra plaza. */
export async function exigirCupoUsuario(
  tx: Prisma.TransactionClient,
  tenantId: string,
  persona: { email: string; userId?: string | null },
) {
  const [s, uso] = await Promise.all([
    tx.suscripcion.findFirst({
      where: { tenantId },
      include: { plan: true, planVersion: true },
    }),
    ocupacionUsuarios(tx, tenantId),
  ]);
  const { limite } = limiteUsuarios(
    s?.plan ?? null,
    s?.usuariosAdicionales ?? 0,
    s?.planVersion,
  );
  const email = normalizar(persona.email);
  if (
    uso.correosActivos.has(email) ||
    (persona.userId && uso.idsActivos.has(persona.userId))
  )
    return;
  const reservado =
    uso.correosPendientes.has(email) ||
    (persona.userId && uso.idsPendientes.has(persona.userId));
  const ocupados = uso.activos + uso.pendientes.length;
  const pendiente = await limitesContratacionPendiente(tx, tenantId);
  const destino = pendiente?.usuarios ?? null;
  const efectivo =
    limite === null
      ? destino
      : destino === null
        ? limite
        : Math.min(limite, destino);
  if (efectivo !== null && ocupados + (reservado ? 0 : 1) > efectivo) {
    throw new ConflictException({
      code: 'CUPO_USUARIOS_AGOTADO',
      limite: efectivo,
      ocupados,
      message:
        pendiente && efectivo === destino
          ? `La contratación pendiente admite ${efectivo} lugares y ya hay ${ocupados} ocupados. Revisá el pago o liberá un acceso antes de sumar otro.`
          : `La empresa tiene ${ocupados} lugares ocupados y un cupo de ${efectivo}. Desactivá un acceso, cancelá una invitación pendiente o ampliá el cupo.`,
    });
  }
}
