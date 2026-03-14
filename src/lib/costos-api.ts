import { apiRequest } from "@/lib/api";
import {
  AreaCosto,
  AreaCostoPayload,
  CentroCosto,
  CentroCostoCapacidad,
  CentroCostoCapacidadPayload,
  CentroCostoComponenteCosto,
  CentroCostoComponenteCostoPayload,
  CentroCostoConfiguracionDetalle,
  CentroCostoPayload,
  CentroCostoRecurso,
  CentroCostoRecursoMaquinariaPayload,
  CentroCostoRecursoMaquinariaPeriodo,
  CentroCostoRecursoPayload,
  CentroCostoTarifaPeriodo,
  Planta,
  PlantaPayload,
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

export async function getAreasCosto() {
  return apiRequest<AreaCosto[]>("/costos/areas");
}

export async function createAreaCosto(payload: AreaCostoPayload) {
  return apiRequest<AreaCosto>("/costos/areas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateAreaCosto(id: string, payload: AreaCostoPayload) {
  return apiRequest<AreaCosto>(`/costos/areas/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function toggleAreaCosto(id: string) {
  return apiRequest<void>(`/costos/areas/${id}/toggle`, {
    method: "PATCH",
  });
}

export async function getCentrosCosto() {
  return apiRequest<CentroCosto[]>("/costos/centros-costo");
}

export async function createCentroCosto(payload: CentroCostoPayload) {
  return apiRequest<CentroCosto>("/costos/centros-costo", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCentroCosto(id: string, payload: CentroCostoPayload) {
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

export async function getCentroCostoConfiguracion(id: string, periodo: string) {
  return apiRequest<CentroCostoConfiguracionDetalle>(
    `/costos/centros-costo/${id}/configuracion?periodo=${encodeURIComponent(periodo)}`,
  );
}

export async function updateCentroCostoConfiguracionBase(
  id: string,
  payload: CentroCostoPayload,
) {
  return apiRequest<CentroCosto>(`/costos/centros-costo/${id}/configuracion-base`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function replaceCentroCostoRecursos(
  id: string,
  periodo: string,
  recursos: CentroCostoRecursoPayload[],
) {
  return apiRequest<CentroCostoRecurso[]>(
    `/costos/centros-costo/${id}/recursos?periodo=${encodeURIComponent(periodo)}`,
    {
      method: "PUT",
      body: JSON.stringify({ recursos }),
    },
  );
}

export async function replaceCentroCostoComponentes(
  id: string,
  periodo: string,
  componentes: CentroCostoComponenteCostoPayload[],
) {
  return apiRequest<CentroCostoComponenteCosto[]>(
    `/costos/centros-costo/${id}/componentes-costo?periodo=${encodeURIComponent(periodo)}`,
    {
      method: "PUT",
      body: JSON.stringify({ componentes }),
    },
  );
}

export async function upsertCentroCostoCapacidad(
  id: string,
  periodo: string,
  payload: CentroCostoCapacidadPayload,
) {
  return apiRequest<CentroCostoCapacidad>(
    `/costos/centros-costo/${id}/capacidad?periodo=${encodeURIComponent(periodo)}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export async function getCentroCostoRecursosMaquinaria(id: string, periodo: string) {
  return apiRequest<CentroCostoRecursoMaquinariaPeriodo[]>(
    `/costos/centros-costo/${id}/recursos-maquinaria?periodo=${encodeURIComponent(periodo)}`,
  );
}

export async function upsertCentroCostoRecursosMaquinaria(
  id: string,
  periodo: string,
  recursos: CentroCostoRecursoMaquinariaPayload[],
) {
  return apiRequest<CentroCostoRecursoMaquinariaPeriodo[]>(
    `/costos/centros-costo/${id}/recursos-maquinaria?periodo=${encodeURIComponent(periodo)}`,
    {
      method: "PUT",
      body: JSON.stringify({ recursos }),
    },
  );
}

export async function calcularTarifaCentroCosto(id: string, periodo: string) {
  return apiRequest<{
    tarifaBorrador: CentroCostoTarifaPeriodo;
    advertencias: string[];
  }>(`/costos/centros-costo/${id}/calcular-tarifa?periodo=${encodeURIComponent(periodo)}`, {
    method: "POST",
  });
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
