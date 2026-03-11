import { apiRequest, ApiError } from "@/lib/api";

export type MembershipRole = "administrador" | "supervisor" | "operador";

export type TenantSummary = {
  id: string;
  nombre: string;
  slug: string;
  rol: MembershipRole;
};

export type CurrentUser = {
  id: string;
  email: string;
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
