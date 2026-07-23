import { apiRequest } from "@/lib/api";
import type {
  ConfigNotificaciones,
  EstadoNotificaciones,
  EstadoPlantillas,
  Integracion,
  LineaLog,
  ProveedorIntegracion,
} from "@/lib/integraciones";

export type EstadoIntegraciones = {
  integraciones: Integracion[];
  /**
   * false = el entorno no tiene clave de cifrado configurada. Se avisa ANTES
   * de pedirle al usuario un token que no vamos a poder guardar.
   */
  cifradoDisponible: boolean;
};

export async function getIntegraciones(): Promise<EstadoIntegraciones> {
  return apiRequest<EstadoIntegraciones>("/integraciones");
}

export type ConectarWatiPayload = {
  endpoint: string;
  tenantId: string;
  token: string;
};

export async function conectarWati(
  payload: ConectarWatiPayload,
): Promise<Integracion> {
  return apiRequest("/integraciones/wati", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function probarIntegracion(
  proveedor: ProveedorIntegracion,
): Promise<Integracion> {
  return apiRequest(`/integraciones/${proveedor}/probar`, { method: "POST" });
}

export async function desconectarIntegracion(
  proveedor: ProveedorIntegracion,
): Promise<void> {
  await apiRequest(`/integraciones/${proveedor}`, { method: "DELETE" });
}

export async function getPlantillasWati(): Promise<EstadoPlantillas> {
  return apiRequest<EstadoPlantillas>("/integraciones/wati/plantillas");
}

export type ResultadoSometer = {
  codigo: string;
  ok: boolean;
  estado: string;
  motivo?: string;
  /**
   * Sólo viene cuando Wati frenó por cupo: Meta acepta 10 plantillas por
   * hora. No es un error a reintentar, es una espera.
   */
  esperaMinutos?: number;
};

export async function someterPlantillaWati(
  codigo: string,
): Promise<ResultadoSometer> {
  return apiRequest(`/integraciones/wati/plantillas/${codigo}/someter`, {
    method: "POST",
  });
}

export async function getNotificaciones(): Promise<EstadoNotificaciones> {
  return apiRequest<EstadoNotificaciones>("/integraciones/notificaciones");
}

export async function getLogNotificaciones(): Promise<LineaLog[]> {
  return apiRequest<LineaLog[]>("/integraciones/notificaciones/log");
}

export async function guardarConfigNotificaciones(
  datos: Partial<ConfigNotificaciones>,
): Promise<ConfigNotificaciones> {
  return apiRequest("/integraciones/notificaciones/configuracion", {
    method: "PUT",
    body: JSON.stringify(datos),
  });
}

export async function cambiarEventoNotificacion(
  evento: string,
  activo: boolean,
): Promise<void> {
  await apiRequest(`/integraciones/notificaciones/eventos/${evento}`, {
    method: "PUT",
    body: JSON.stringify({ activo }),
  });
}
