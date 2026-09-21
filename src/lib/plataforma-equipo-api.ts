import { apiRequest } from "./api";
import type { MfaChallenge, PlatformAuthResponse } from "./auth";

export type InvitacionEquipo = {
  id: string;
  email: string;
  rol: RolEquipo;
  creadaEl: string;
  venceEl: string;
  estado: "pendiente" | "aceptada" | "cancelada" | "vencida";
  invitador: string;
};
export type InvitacionesEquipo = {
  total: number;
  pagina: number;
  limite: number;
  invitaciones: InvitacionEquipo[];
};
export type EnlaceInvitacionEquipo = {
  id: string;
  email: string;
  venceEl: string;
  url: string;
};
export type EstadoInvitacionEquipo = {
  email: string;
  rol: RolEquipo;
  venceEl: string;
  requiereCrearClave: boolean;
};
export const invitarEquipo = (email: string, rol: RolEquipo, motivo: string) =>
  apiRequest<EnlaceInvitacionEquipo>("/plataforma/equipo/invitaciones", {
    method: "POST",
    body: JSON.stringify({ email, rol, motivo }),
  });
export const gestionarInvitacionEquipo = (
  id: string,
  accion: "renovar" | "cancelar",
  motivo: string,
) =>
  apiRequest<EnlaceInvitacionEquipo | { ok: boolean }>(
    `/plataforma/equipo/invitaciones/${id}`,
    { method: "POST", body: JSON.stringify({ accion, motivo }) },
  );
export const consultarInvitacionEquipo = (token: string) =>
  apiRequest<EstadoInvitacionEquipo>(
    "/auth/invitacion-plataforma/consultar",
    { method: "POST", body: JSON.stringify({ token }) },
    { auth: false },
  );
export const aceptarInvitacionEquipo = (
  token: string,
  password: string,
  nombre?: string,
) =>
  apiRequest<PlatformAuthResponse | MfaChallenge>(
    "/auth/invitacion-plataforma/aceptar",
    {
      method: "POST",
      body: JSON.stringify({ token, password, ...(nombre ? { nombre } : {}) }),
    },
    { auth: false },
  );

export type RolEquipo = "ADMIN" | "SOPORTE";
export type OperadorPlataforma = {
  id: string;
  email: string;
  nombre: string | null;
  activo: boolean;
  rol: RolEquipo;
  esPropio: boolean;
  mfaActivo: boolean;
  recuperacionConfirmada: boolean;
  sesionesActivas: number;
  ultimaSesionActivaEl: string | null;
};
export type EquipoPlataforma = {
  total: number;
  pagina: number;
  limite: number;
  roles: Array<{ codigo: RolEquipo; nombre: string; descripcion: string }>;
  usuarios: OperadorPlataforma[];
};
export type HistorialEquipo = {
  total: number;
  pagina: number;
  limite: number;
  eventos: Array<{
    id: string;
    tipo: string;
    descripcion: string;
    creadoEl: string;
    actor: string;
  }>;
};
export type AccionEquipo = "rol" | "revocar" | "sesiones";
export const agregarOperador = (
  email: string,
  rol: RolEquipo,
  motivo: string,
) =>
  apiRequest<{ ok: boolean }>("/plataforma/equipo", {
    method: "POST",
    body: JSON.stringify({ email, rol, motivo }),
  });
export const actualizarOperador = (
  usuario: OperadorPlataforma,
  accion: AccionEquipo,
  rol: RolEquipo,
  motivo: string,
) =>
  apiRequest<{ ok: boolean; sesionActualCerrada: boolean }>(
    `/plataforma/equipo/${usuario.id}`,
    {
      method: "PUT",
      body: JSON.stringify({
        accion,
        rolActual: usuario.rol,
        ...(accion === "rol" ? { rol } : {}),
        motivo,
      }),
    },
  );
