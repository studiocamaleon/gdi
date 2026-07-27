import { apiRequest } from "@/lib/api";
import {
  CentroCosto,
  CentroCostoCapacidad,
  CentroCostoCapacidadManualPayload,
  CentroCostoConfiguracionDetalle,
  CentroCostoLinea,
  CentroCostoLineaPayload,
  CentroCostoPayload,
  CentroCostoTarifaPeriodo,
  Planta,
  PlantaPayload,
  ResumenCentrosCosto,
} from "@/lib/costos";

export async function getPlantas() {
  return apiRequest<Planta[]>("/costos/plantas");
}

export async function createPlanta(payload: PlantaPayload) {
  return apiRequest<Planta>("/costos/plantas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePlanta(id: string, payload: PlantaPayload) {
  return apiRequest<Planta>(`/costos/plantas/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function togglePlanta(id: string) {
  return apiRequest<void>(`/costos/plantas/${id}/toggle`, {
    method: "PATCH",
  });
}

export async function getCentrosCosto() {
  return apiRequest<CentroCosto[]>("/costos/centros-costo");
}

/**
 * El listado con los números vivos del período. No sale del último snapshot de
 * tarifa: ese puede haber quedado viejo respecto de su propia planilla, y el
 * listado tiene que decir lo que el centro cuesta hoy.
 */
export async function getResumenCentrosCosto(periodo: string) {
  return apiRequest<ResumenCentrosCosto>(
    `/costos/centros-costo/resumen?periodo=${encodeURIComponent(periodo)}`,
  );
}

export async function createCentroCosto(payload: CentroCostoPayload) {
  return apiRequest<CentroCosto>("/costos/centros-costo", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCentroCosto(
  id: string,
  payload: CentroCostoPayload,
) {
  return apiRequest<CentroCosto>(`/costos/centros-costo/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function toggleCentroCosto(id: string) {
  return apiRequest<void>(`/costos/centros-costo/${id}/toggle`, {
    method: "PATCH",
  });
}

export async function eliminarCentroCosto(id: string) {
  return apiRequest<{ id: string; eliminado: boolean }>(
    `/costos/centros-costo/${id}`,
    { method: "DELETE" },
  );
}

export async function getCentroCostoConfiguracion(id: string, periodo: string) {
  return apiRequest<CentroCostoConfiguracionDetalle>(
    `/costos/centros-costo/${id}/configuracion?periodo=${encodeURIComponent(periodo)}`,
  );
}

export async function updateCentroCostoConfiguracionBase(
  id: string,
  payload: CentroCostoPayload,
) {
  return apiRequest<CentroCosto>(
    `/costos/centros-costo/${id}/configuracion-base`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

/**
 * Reemplaza la planilla entera del período: las tres secciones de una. El
 * importe de cada línea NO se manda — lo calcula el servidor.
 */
export async function replaceCentroCostoLineas(
  id: string,
  periodo: string,
  lineas: CentroCostoLineaPayload[],
) {
  return apiRequest<CentroCostoLinea[]>(
    `/costos/centros-costo/${id}/lineas?periodo=${encodeURIComponent(periodo)}`,
    {
      method: "PUT",
      body: JSON.stringify({ lineas }),
    },
  );
}

export async function upsertCentroCostoCapacidad(
  id: string,
  periodo: string,
  payload: CentroCostoCapacidadManualPayload,
) {
  return apiRequest<CentroCostoCapacidad>(
    `/costos/centros-costo/${id}/capacidad?periodo=${encodeURIComponent(periodo)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export async function calcularTarifaCentroCosto(id: string, periodo: string) {
  return apiRequest<{
    tarifaBorrador: CentroCostoTarifaPeriodo;
    advertencias: string[];
  }>(
    `/costos/centros-costo/${id}/calcular-tarifa?periodo=${encodeURIComponent(periodo)}`,
    {
      method: "POST",
    },
  );
}

export async function publicarTarifaCentroCosto(id: string, periodo: string) {
  return apiRequest<CentroCostoTarifaPeriodo>(
    `/costos/centros-costo/${id}/publicar-tarifa?periodo=${encodeURIComponent(periodo)}`,
    {
      method: "POST",
    },
  );
}

export async function getCentroCostoTarifas(id: string) {
  return apiRequest<CentroCostoTarifaPeriodo[]>(
    `/costos/centros-costo/${id}/tarifas`,
  );
}
