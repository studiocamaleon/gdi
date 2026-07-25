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
   * Permisos efectivos, ya expandidos (`gestionar` trae su `ver`).
   *
   * Se resuelven en el AuthGuard desde el rol de la membership, NO desde el
   * JWT: un token firmado con los permisos adentro no se puede cambiar sin
   * re-loguear, y quitarle un permiso a alguien tiene que surtir efecto ya —
   * es lo primero que hace un admin cuando alguien vio algo que no debía.
   * Vacío en sesiones de plataforma, que se autorizan por otro eje.
   */
  permisos?: Set<string>;
  /**
   * Desde qué IPs puede usarse esta sesión. Vacío = desde cualquier lado.
   * Viaja en el auth para que el cache de sesión pueda revalidarla sin volver
   * a la base. Ver auth/ip.ts
   */
  ipsPermitidas?: string[];
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
