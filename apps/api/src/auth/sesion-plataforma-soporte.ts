import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CurrentAuth } from './auth.types';
import { bloquearIdentidad } from './mfa.service';
import { mfaPlataformaCompleta } from './enrolamiento-plataforma';

/** La autorización y la nueva sesión de soporte deben compartir transacción.
 * Conserva identidad y origen bloqueados frente a cambios de MFA/clave/rol
 * y al logout, en ese orden. No concede MFA usando la hora de emisión. */
export async function exigirSesionPlataformaParaSoporte(
  tx: Prisma.TransactionClient,
  auth: CurrentAuth,
) {
  if (!auth.esPlataforma || auth.impersonacion || auth.mcp) {
    throw new ForbiddenException(
      'Ingresá al backoffice con tu sesión personal.',
    );
  }
  await bloquearIdentidad(tx, auth.userId);
  await tx.$queryRaw`SELECT id FROM "AuthSession" WHERE id = ${auth.sessionId}::uuid FOR UPDATE`;
  const origen = await tx.authSession.findUnique({
    where: { id: auth.sessionId },
    include: { user: { include: { mfa: true } } },
  });
  if (
    !origen ||
    origen.userId !== auth.userId ||
    origen.revokedAt ||
    origen.expiresAt <= new Date() ||
    origen.currentTenantId ||
    origen.currentMembershipId ||
    origen.impersonacionId ||
    !origen.user.activo ||
    origen.user.rolPlataforma !== 'ADMIN' ||
    origen.user.debeCambiarPassword ||
    !mfaPlataformaCompleta(origen.user.mfa, origen.mfaVerificadoEl)
  ) {
    throw new UnauthorizedException(
      'Tu acceso de plataforma cambió. Volvé a iniciar sesión.',
    );
  }
  return origen;
}
