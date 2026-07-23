import { RolSistema } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  sessionId: string;
  tenantId: string;
  /** Vacío en tokens de impersonación (el staff no tiene membership). */
  membershipId: string;
  role: RolSistema;
  email: string;
  /** Presente = token de impersonación del control plane. */
  imp?: {
    sesionId: string;
    actorUserId: string;
    actorNombre: string;
  };
  /** true = sesión de PLATAFORMA (backoffice): sin tenant. */
  plat?: boolean;
};

export type CurrentAuth = {
  userId: string;
  sessionId: string;
  tenantId: string;
  membershipId: string;
  role: RolSistema;
  email: string;
  /**
   * Impersonación: el staff del control plane operando DENTRO de un tenant.
   * `userId`/`tenantId`/`role` son los del tenant impersonado (ADMINISTRADOR),
   * para que todo lo de negocio funcione igual; el actor real viaja acá.
   * undefined = sesión normal.
   */
  impersonacion?: {
    sesionId: string;
    actorUserId: string;
    /** "Soporte Grafo (Nombre)" — se firma con esto lo que el tenant ve. */
    actorNombre: string;
  };
  /**
   * Sesión de plataforma (backoffice): el staff NO está en un tenant. En esta
   * sesión `tenantId` es '' y el AuthGuard sólo deja pasar rutas @SinTenant —
   * así una sesión de plataforma no puede operar como tenant (que, sin
   * contexto, leería todos). undefined = sesión de tenant.
   */
  esPlataforma?: boolean;
};
