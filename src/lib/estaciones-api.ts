import { apiRequest } from "@/lib/api";
import type {
  Estacion,
  EstacionPayload,
  FamiliaPasoCatalogo,
} from "@/lib/estaciones";

export async function getEstaciones() {
  return apiRequest<Estacion[]>("/produccion/estaciones");
}

/** Catálogo de familias de pasos + qué estación tiene tomada cada una. */
export async function getFamiliasPasos() {
  return apiRequest<FamiliaPasoCatalogo[]>("/produccion/familias-pasos");
}

/**
 * Mediana histórica de duración real por familia de pasos (fallback de la
 * cola en horas del tablero; sólo familias con muestras suficientes).
 */
export type DuracionFamilia = {
  familiaCodigo: string;
  medianaMin: number;
  muestras: number;
};

export async function getDuracionesFamilias() {
  return apiRequest<DuracionFamilia[]>("/produccion/duraciones-familias");
}

/**
 * Feriados y cierres del taller (fechas no laborables a nivel tenant):
 * la proyección de cola y la simulación de flujo los saltan.
 */
export type DiaNoLaborable = {
  id: string;
  /** "YYYY-MM-DD". */
  fecha: string;
  descripcion: string;
};

export async function getDiasNoLaborables() {
  return apiRequest<DiaNoLaborable[]>("/produccion/dias-no-laborables");
}

export async function crearDiaNoLaborable(payload: { fecha: string; descripcion?: string }) {
  return apiRequest<DiaNoLaborable>("/produccion/dias-no-laborables", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function eliminarDiaNoLaborable(id: string) {
  return apiRequest<{ ok: boolean }>(`/produccion/dias-no-laborables/${id}`, {
    method: "DELETE",
  });
}

/**
 * Configuración de producción del tenant: margen de seguridad (en días
 * hábiles) que el cotizador suma a la ETA cruda al sugerir fecha, y hora
 * de corte de jornada a la que los cronómetros abiertos se cierran solos
 * (registro-tiempos-produccion D9).
 */
export type ConfiguracionProduccion = {
  margenEtaDias: number;
  tiempoEntrePasosMin: number;
  /** "HH:mm". */
  corteJornada: string;
};

export async function getConfiguracionProduccion() {
  return apiRequest<ConfiguracionProduccion>("/produccion/configuracion");
}

export async function actualizarConfiguracionProduccion(payload: {
  margenEtaDias: number;
  tiempoEntrePasosMin: number;
  corteJornada?: string;
}) {
  return apiRequest<ConfiguracionProduccion>("/produccion/configuracion", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function createEstacion(payload: EstacionPayload) {
  return apiRequest<Estacion>("/produccion/estaciones", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEstacion(id: string, payload: EstacionPayload) {
  return apiRequest<Estacion>(`/produccion/estaciones/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function toggleEstacion(id: string) {
  return apiRequest<Estacion>(`/produccion/estaciones/${id}/toggle`, {
    method: "PATCH",
  });
}

export async function deleteEstacion(id: string) {
  return apiRequest<{ ok: boolean }>(`/produccion/estaciones/${id}`, {
    method: "DELETE",
  });
}
