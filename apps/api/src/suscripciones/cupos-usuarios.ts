import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { contratoCompatible } from './evaluador-capacidades';

type Lectura = Pick<
  Prisma.TransactionClient,
  'suscripcion' | 'membership' | 'invitation'
>;
const normalizar = (email: string) => email.trim().toLowerCase();

export function limiteUsuarios(
  plan: { featuresJson: unknown } | null,
  adicionales = 0,
) {
  const incluidos = contratoCompatible(plan).limites.usuariosMax;
  return {
    incluidos,
    adicionales,
    limite: incluidos === null ? null : incluidos + adicionales,
  };
}

/** Toda escritura de accesos y cupos toma este lock ANTES de leer o contar.
 * Con READ COMMITTED, la siguiente alta ve lo que confirmó la anterior. */
export async function bloquearCupoUsuarios(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  const filas = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Tenant" WHERE id = ${tenantId}::uuid FOR UPDATE`;
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
    db.suscripcion.findFirst({ where: { tenantId }, include: { plan: true } }),
    ocupacionUsuarios(db, tenantId),
  ]);
  const limites = limiteUsuarios(
    suscripcion?.plan ?? null,
    suscripcion?.usuariosAdicionales ?? 0,
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
    tx.suscripcion.findFirst({ where: { tenantId }, include: { plan: true } }),
    ocupacionUsuarios(tx, tenantId),
  ]);
  const { limite } = limiteUsuarios(
    s?.plan ?? null,
    s?.usuariosAdicionales ?? 0,
  );
  const email = normalizar(persona.email);
  if (
    limite === null ||
    uso.correosActivos.has(email) ||
    (persona.userId && uso.idsActivos.has(persona.userId))
  )
    return;
  const reservado =
    uso.correosPendientes.has(email) ||
    (persona.userId && uso.idsPendientes.has(persona.userId));
  const ocupados = uso.activos + uso.pendientes.length;
  if (ocupados + (reservado ? 0 : 1) > limite) {
    throw new ConflictException({
      code: 'CUPO_USUARIOS_AGOTADO',
      limite,
      ocupados,
      message: `La empresa tiene ${ocupados} lugares ocupados y un cupo de ${limite}. Desactivá un acceso, cancelá una invitación pendiente o ampliá el cupo.`,
    });
  }
}
