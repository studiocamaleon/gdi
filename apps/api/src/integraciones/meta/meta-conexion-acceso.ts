import { ForbiddenException } from '@nestjs/common';
import { Prisma, RolSistema } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import { ipPermitida } from '../../auth/ip';
import { expandir, permisosDeRolBase } from '../../auth/permisos';

/** Revalidar también después de la llamada a Meta: durante el popup pueden
 * cerrar la sesión, cambiar de empresa o quitar permisos al administrador. */
async function exigirAcceso(
  db: Pick<Prisma.TransactionClient, 'authSession'>,
  auth: CurrentAuth,
  ip: string,
  inbox = false,
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
    !ipPermitida(ip, miembro.ipsPermitidas) ||
    !(inbox
      ? puedeAtenderInbox(miembro)
      : miembro.rol === RolSistema.ADMINISTRADOR &&
        expandir(
          miembro.rolDelTenant?.permisos ?? permisosDeRolBase(miembro.rol),
        ).has('configuracion.gestionar'))
  )
    throw new ForbiddenException();
  return expandir(
    miembro.rolDelTenant?.permisos ?? permisosDeRolBase(miembro.rol),
  );
}

export function puedeAtenderInbox(miembro: {
  rol: RolSistema;
  rolDelTenant: { permisos: string[] } | null;
}) {
  const permisos = expandir(
    miembro.rolDelTenant?.permisos ?? permisosDeRolBase(miembro.rol),
  );
  return (
    permisos.has('inbox.atender') ||
    (miembro.rol === RolSistema.ADMINISTRADOR &&
      permisos.has('configuracion.gestionar'))
  );
}
export const exigirAccesoConexionMeta = (
  db: Pick<Prisma.TransactionClient, 'authSession'>,
  auth: CurrentAuth,
  ip: string,
) => exigirAcceso(db, auth, ip);
export const exigirAccesoInbox = (
  db: Pick<Prisma.TransactionClient, 'authSession'>,
  auth: CurrentAuth,
  ip: string,
) => exigirAcceso(db, auth, ip, true);
