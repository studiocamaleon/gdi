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
  /** Vacío = entra desde cualquier lado. IP exacta o CIDR v4. */
  ipsPermitidas: string[];
  activa: boolean;
  empleado: { id: string; nombreCompleto: string } | null;
  estado: EstadoUsuario;
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

export type SesionAbierta = {
  id: string;
  usuarioId: string;
  usuarioNombre: string;
  email: string;
  desde: string;
  expira: string;
  /** La del que está mirando: no se ofrece cerrarla desde acá. */
  esLaMia: boolean;
  esImpersonacion: boolean;
};

/** Desde qué IP está mirando quien pregunta: la UI la ofrece con un click. */
export async function getMiIp(): Promise<{ ip: string; esPublica: boolean }> {
  return apiRequest("/usuarios/mi-ip", { cache: "no-store" });
}

/** Vacío = puede entrar desde cualquier lado. */
export async function cambiarIps(
  userId: string,
  ips: string[],
): Promise<{ ipsPermitidas: string[] }> {
  return apiRequest(`/usuarios/${encodeURIComponent(userId)}/ips`, {
    method: "PUT",
    body: JSON.stringify({ ips }),
  });
}

export async function getSesiones(): Promise<SesionAbierta[]> {
  return apiRequest("/usuarios/sesiones", { cache: "no-store" });
}

export async function cerrarSesiones(
  userId: string,
): Promise<{ cerradas: number }> {
  return apiRequest(
    `/usuarios/${encodeURIComponent(userId)}/cerrar-sesiones`,
    { method: "POST" },
  );
}

export async function getHistorialAccesos(): Promise<EventoAcceso[]> {
  return apiRequest("/usuarios/historial", { cache: "no-store" });
}

export async function getCatalogoPermisos(): Promise<CatalogoPermisos> {
  return apiRequest("/usuarios/catalogo", { cache: "no-store" });
}

/**
 * Da el acceso y devuelve la clave provisoria para dictarle. Única forma de
 * entrega: el modo "le mando un link" se retiró porque nunca hubo nada que
 * mandara el link (ver usuarios-view.tsx).
 */
export async function crearUsuario(datos: {
  email: string;
  nombreCompleto?: string;
  rolId: string;
  empleadoId?: string;
}): Promise<{
  provisoria: string | null;
  yaTeniaCuenta: boolean;
}> {
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

/**
 * Le pone una clave provisoria y devuelve la que hay que dictarle. Se muestra
 * una sola vez: no queda guardada en ningún lado legible.
 */
export async function restablecerPassword(
  userId: string,
): Promise<{ provisoria: string; email: string }> {
  return apiRequest(`/usuarios/${encodeURIComponent(userId)}/password`, {
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
