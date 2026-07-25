import { apiRequest, ApiError } from "@/lib/api";

export type MembershipRole = "administrador" | "supervisor" | "operador";

export type TenantSummary = {
  id: string;
  nombre: string;
  slug: string;
  rol: MembershipRole;
  /** El nombre del rol tal como lo ve la gente: "Vendedor", no "supervisor". */
  rolNombre?: string | null;
  /**
   * Permisos efectivos en ESTA empresa, ya expandidos (`gestionar` trae su
   * `ver`). Sólo viene en `tenantActual`: los otros tenants de la lista se
   * usan para el switcher, y sus permisos se resuelven al cambiarse.
   *
   * La UI los usa para no mostrar lo que el API va a rechazar igual. Es
   * cortesía, no seguridad — la autorización real la hace el API en cada
   * request. Ver docs/usuarios-roles-permisos-diseno.md
   */
  permisos?: string[];
  /** Null cuando el tenant no tiene plan asignado (legacy): la card no
   *  inventa un plan ni un contador, muestra su texto neutro. */
  suscripcion?: {
    planNombre?: string | null;
    estado?: string | null;
    diasRestantes?: number | null;
    /** Largo del período. Null si no se conoce su inicio — ahí se muestran
     *  sólo los días restantes, sin fracción. */
    diasTotales?: number | null;
    venceEl?: string | null;
    enPrueba?: boolean;
  } | null;
};

export type CurrentUser = {
  id: string;
  email: string;
  nombreCompleto?: string | null;
  /** Rol en el control plane (staff de Grafo). Sólo decide si la UI muestra
   *  el acceso a /plataforma; la autorización real la hace el API. */
  rolPlataforma?: "ADMIN" | "SOPORTE" | null;
  /** Presente = esta sesión es una impersonación del control plane. */
  impersonacion?: { actorNombre: string; expiraEl: string } | null;
  tenantActual: TenantSummary;
  tenants: TenantSummary[];
};

export type AuthResponse = {
  accessToken: string | null;
  sessionId: string;
  currentUser: CurrentUser;
};

export type InvitationState = {
  email: string;
  tenantNombre: string;
  rol: MembershipRole;
  requiresPasswordSetup: boolean;
};

export async function login(email: string, password: string) {
  return apiRequest<AuthResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    { auth: false },
  );
}

export async function loginPlataforma(email: string, password: string) {
  return apiRequest<{
    accessToken: string | null;
    sessionId: string;
    staff: {
      id: string;
      email: string;
      nombreCompleto: string | null;
      rolPlataforma: "ADMIN" | "SOPORTE";
    };
  }>(
    "/auth/login-plataforma",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    { auth: false },
  );
}

export async function logout() {
  return apiRequest<void>("/auth/logout", {
    method: "POST",
  });
}

export async function getCurrentUser() {
  return apiRequest<{ accessToken: string | null; sessionId: string; currentUser: CurrentUser }>(
    "/tenants/current",
  );
}

export async function switchTenant(tenantId: string) {
  return apiRequest<AuthResponse>("/tenants/switch", {
    method: "POST",
    body: JSON.stringify({ tenantId }),
  });
}

export async function salirDeImpersonacion() {
  return apiRequest<{ accessToken: string | null }>(
    "/auth/salir-impersonacion",
    { method: "POST" },
  );
}

export async function getInvitationState(token: string) {
  return apiRequest<InvitationState>(`/auth/invitations/${token}`, undefined, {
    auth: false,
  });
}

export async function acceptInvitation(token: string, password?: string) {
  return apiRequest<AuthResponse>(
    `/auth/invitations/${token}/accept`,
    {
      method: "POST",
      body: JSON.stringify(password ? { password } : {}),
    },
    { auth: false },
  );
}

export async function tryGetCurrentUser() {
  try {
    return await getCurrentUser();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}
