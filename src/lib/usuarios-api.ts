/**
 * Configuración → Usuarios. Espejo de apps/api/src/usuarios/.
 * Ver docs/usuarios-roles-permisos-diseno.md
 */

import { apiRequest } from "@/lib/api";

/** `pendiente` = tiene acceso pero todavía no fijó su contraseña. */
export type EstadoUsuario = "activo" | "pendiente" | "desactivado";

export type UsuarioDelTenant = {
  id: string;
  membershipId: string;
  email: string;
  nombreCompleto: string | null;
  rolId: string | null;
  rolNombre: string;
  activa: boolean;
  empleado: { id: string; nombreCompleto: string } | null;
  estado: EstadoUsuario;
  invitacionVence: string | null;
  /** El que está mirando: no puede tocarse a sí mismo. */
  esYo: boolean;
};

export type ListadoUsuarios = {
  usuarios: UsuarioDelTenant[];
  /** Tope del plan. Null = sin límite (tenant legacy o plan ilimitado). */
  limite: number | null;
  enUso: number;
};

export type RolDelTenant = {
  id: string;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  esDelSistema: boolean;
  permisos: string[];
  usuarios: number;
};

export type CatalogoPermisos = {
  modulos: Array<{
    clave: string;
    label: string;
    descripcion: string;
    enElPlan: boolean;
  }>;
  transversales: Array<{ clave: string; label: string; descripcion: string }>;
  features: { afip: boolean; whatsapp: boolean };
};

export async function getUsuarios(): Promise<ListadoUsuarios> {
  return apiRequest("/usuarios", { cache: "no-store" });
}

export async function getRoles(): Promise<RolDelTenant[]> {
  return apiRequest("/usuarios/roles", { cache: "no-store" });
}

export type EventoAcceso = {
  id: string;
  tipo: string;
  /** Quién lo hizo, congelado al momento del hecho. */
  actorNombre: string;
  usuarioAfectadoNombre: string | null;
  descripcion: string;
  createdAt: string;
};

export async function getHistorialAccesos(): Promise<EventoAcceso[]> {
  return apiRequest("/usuarios/historial", { cache: "no-store" });
}

export async function getCatalogoPermisos(): Promise<CatalogoPermisos> {
  return apiRequest("/usuarios/catalogo", { cache: "no-store" });
}

export async function crearUsuario(datos: {
  email: string;
  nombreCompleto?: string;
  rolId: string;
  empleadoId?: string;
}): Promise<{ invitacionUrl: string; yaTeniaCuenta: boolean }> {
  return apiRequest("/usuarios", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function editarUsuario(
  userId: string,
  datos: { rolId?: string; activa?: boolean; empleadoId?: string | null },
): Promise<{ ok: true }> {
  return apiRequest(`/usuarios/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  });
}

/** Vuelve a emitir el link: el anterior deja de servir. */
export async function reenviarInvitacion(
  userId: string,
): Promise<{ invitacionUrl: string }> {
  return apiRequest(`/usuarios/${encodeURIComponent(userId)}/invitacion`, {
    method: "POST",
  });
}

export async function crearRol(datos: {
  nombre: string;
  descripcion?: string;
  permisos: string[];
}): Promise<{ id: string }> {
  return apiRequest("/usuarios/roles", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

export async function editarRol(
  rolId: string,
  datos: { nombre?: string; descripcion?: string; permisos?: string[] },
): Promise<{ ok: true }> {
  return apiRequest(`/usuarios/roles/${encodeURIComponent(rolId)}`, {
    method: "PATCH",
    body: JSON.stringify(datos),
  });
}

/** `destinoId` es obligatorio si el rol tiene usuarios: se mudan ahí. */
export async function eliminarRol(
  rolId: string,
  destinoId?: string,
): Promise<{ ok: true }> {
  return apiRequest(`/usuarios/roles/${encodeURIComponent(rolId)}`, {
    method: "DELETE",
    body: JSON.stringify({ destinoId }),
  });
}
