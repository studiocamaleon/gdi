import { ForbiddenException } from '@nestjs/common';
import { Prisma, RolSistema } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import { ipPermitida } from '../../auth/ip';
import { expandir, permisosDeRolBase } from '../../auth/permisos';

/** Revalidar también después de la llamada a Meta: durante el popup pueden
 * cerrar la sesión, cambiar de empresa o quitar permisos al administrador. */
export async function exigirAccesoConexionMeta(
  db: Pick<Prisma.TransactionClient, 'authSession'>,
  auth: CurrentAuth,
  ip: string,
) {
  if (auth.mcp || auth.esPlataforma || auth.impersonacion || !auth.tenantId)
    throw new ForbiddenException();
  const sesion = await db.authSession.findUnique({
    where: { id: auth.sessionId },
    select: {
      userId: true,
      currentTenantId: true,
      currentMembershipId: true,
      revokedAt: true,
      expiresAt: true,
      impersonacionId: true,
      user: { select: { activo: true, debeCambiarPassword: true } },
      currentTenant: { select: { activo: true } },
      currentMembership: {
        select: {
          activa: true,
          userId: true,
          tenantId: true,
          rol: true,
          ipsPermitidas: true,
          rolDelTenant: { select: { permisos: true } },
        },
      },
    },
  });
  const miembro = sesion?.currentMembership;
  if (
    !sesion ||
    sesion.revokedAt ||
    sesion.expiresAt.getTime() <= Date.now() ||
    sesion.impersonacionId ||
    !sesion.user.activo ||
    sesion.user.debeCambiarPassword ||
    !sesion.currentTenant?.activo ||
    sesion.userId !== auth.userId ||
    sesion.currentTenantId !== auth.tenantId ||
    sesion.currentMembershipId !== auth.membershipId ||
    !miembro?.activa ||
    miembro.userId !== auth.userId ||
    miembro.tenantId !== auth.tenantId ||
    miembro.rol !== RolSistema.ADMINISTRADOR ||
    !ipPermitida(ip, miembro.ipsPermitidas) ||
    !expandir(
      miembro.rolDelTenant?.permisos ?? permisosDeRolBase(miembro.rol),
    ).has('configuracion.gestionar')
  )
    throw new ForbiddenException();
  return expandir(
    miembro.rolDelTenant?.permisos ?? permisosDeRolBase(miembro.rol),
  );
}
