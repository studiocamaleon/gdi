import { ForbiddenException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import { mfaPlataformaCompleta } from '../../auth/enrolamiento-plataforma';

export async function autorizarEdicionPlanes(
  tx: Prisma.TransactionClient,
  auth: CurrentAuth,
) {
  if (
    !auth.esPlataforma ||
    auth.impersonacion ||
    auth.mcp ||
    auth.plataformaMfaPendiente !== false
  )
    throw new ForbiddenException(
      'Usá una sesión personal de administración de Plataforma.',
    );
  // Compartido con equipo y borradores: serializa revocaciones y publicaciones.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(724611, 1)::text`;
  const actor = await tx.user.findUnique({
    where: { id: auth.userId },
    select: {
      activo: true,
      nombreCompleto: true,
      rolPlataforma: true,
      mfa: {
        select: { activatedAt: true, recuperacionConfirmadaEl: true },
      },
    },
  });
  const sesion = await tx.authSession.findFirst({
    where: {
      id: auth.sessionId,
      userId: auth.userId,
      currentTenantId: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { mfaVerificadoEl: true },
  });
  if (
    !actor?.activo ||
    actor.rolPlataforma !== 'ADMIN' ||
    !sesion ||
    !mfaPlataformaCompleta(actor.mfa, sesion.mfaVerificadoEl)
  )
    throw new ForbiddenException(
      'Esta acción requiere una sesión vigente de administración de Plataforma.',
    );
  return actor;
}
