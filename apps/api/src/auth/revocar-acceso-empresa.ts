import type { Prisma } from '@prisma/client';

/** Invocar dentro de la baja, con la identidad bloqueada. Una reactivación
 * futura requiere accesos nuevos; conserva los accesos de otras empresas. */
export async function revocarAccesoEmpresa(
  tx: Prisma.TransactionClient,
  tenantId: string,
  userId: string,
) {
  const miembros = await tx.membership.findMany({
    where: { tenantId, userId },
    select: { id: true },
  });
  const membershipId = { in: miembros.map((m) => m.id) };
  const ahora = new Date();
  await tx.authSession.updateMany({
    where: { userId, currentTenantId: tenantId, revokedAt: null },
    data: { revokedAt: ahora },
  });
  await tx.credencialMcp.updateMany({
    where: { tenantId, membershipId, revocadoEl: null },
    data: { revocadoEl: ahora },
  });
  await tx.mfaChallenge.deleteMany({ where: { userId, membershipId } });
}
