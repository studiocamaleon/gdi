import { apiRequest } from '@/lib/api';
import {
  Proceso,
  ProcesoOperacionPlantilla,
  ProcesoOperacionPlantillaPayload,
  ProcesoPayload,
} from '@/lib/procesos';

export type ProcesoVersion = {
  id: string;
  version: number;
  data: Record<string, unknown>;
  createdAt: string;
};

export type ProcesoSnapshotOperacion = {
  operacionId: string;
  orden: number;
  codigo: string;
  nombre: string;
  centroCostoId: string;
  centroCostoNombre: string;
  maquinaId: string | null;
  maquinaNombre: string;
  setupMin: number;
  runMin: number;
  cleanupMin: number;
  tiempoFijoMin: number;
  totalMin: number;
  horasEfectivas: number;
  tarifaCentro: number | null;
  costoTiempo: number;
  modoProductividad: string;
  productividadAplicada: number | null;
  cantidadRun: number;
  mermaSetupAplicada: number;
  mermaRunPctAplicada: number;
  warnings: string[];
};

export type ProcesoCostoSnapshot = {
  procesoId: string;
  procesoCodigo: string;
  procesoNombre: string;
  version: number;
  periodo: string;
  cantidadObjetivo: number;
  contexto: Record<string, unknown>;
  costoTiempoTotal: number;
  operaciones: ProcesoSnapshotOperacion[];
  advertencias: string[];
  validaParaCotizar: boolean;
};

export type EvaluarProcesoCostoPayload = {
  periodo: string;
  cantidadObjetivo: number;
  contexto?: Record<string, unknown>;
};

export async function getProcesos() {
  const res = await apiRequest<{ data: Proceso[] }>('/procesos?limit=200');
  return res.data;
}

export async function getProceso(id: string) {
  return apiRequest<Proceso>(`/procesos/${id}`);
}

export async function createProceso(payload: ProcesoPayload) {
  return apiRequest<Proceso>('/procesos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProceso(id: string, payload: ProcesoPayload) {
  return apiRequest<Proceso>(`/procesos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function toggleProceso(id: string) {
  return apiRequest<Proceso>(`/procesos/${id}/toggle`, {
    method: 'PATCH',
  });
}

export async function getProcesoVersiones(id: string) {
  return apiRequest<ProcesoVersion[]>(`/procesos/${id}/versiones`);
}

export async function getProcesoSnapshotCosto(id: string, periodo: string) {
  return apiRequest<ProcesoCostoSnapshot>(
    `/procesos/${id}/snapshot-costo?periodo=${encodeURIComponent(periodo)}`,
    {
      method: 'POST',
    },
  );
}

export async function evaluarProcesoCosto(
  id: string,
  payload: EvaluarProcesoCostoPayload,
) {
  return apiRequest<ProcesoCostoSnapshot>(`/procesos/${id}/evaluar-costo`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getProcesoOperacionPlantillas() {
  return apiRequest<ProcesoOperacionPlantilla[]>('/procesos/biblioteca-operaciones');
}

export async function createProcesoOperacionPlantilla(
  payload: ProcesoOperacionPlantillaPayload,
) {
  return apiRequest<ProcesoOperacionPlantilla>('/procesos/biblioteca-operaciones', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateProcesoOperacionPlantilla(
  id: string,
  payload: ProcesoOperacionPlantillaPayload,
) {
  return apiRequest<ProcesoOperacionPlantilla>(`/procesos/biblioteca-operaciones/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function toggleProcesoOperacionPlantilla(id: string) {
  return apiRequest<ProcesoOperacionPlantilla>(
    `/procesos/biblioteca-operaciones/${id}/toggle`,
    {
      method: 'PATCH',
    },
  );
}

export async function bulkAssignEstacionPlantillas(
  ids: string[],
  estacionId: string | null,
) {
  return apiRequest<ProcesoOperacionPlantilla[]>(
    '/procesos/biblioteca-operaciones/bulk-assign-estacion',
    {
      method: 'PATCH',
      body: JSON.stringify({ ids, estacionId }),
    },
  );
}

// P1.3 — ProcesoOperacionAlternativa: múltiples máquina+perfil por paso.
export type ProcesoOperacionAlternativa = {
  id: string;
  procesoOperacionId: string;
  label: string;
  esDefault: boolean;
  orden: number;
  activo: boolean;
  maquinaId: string;
  perfilOperativoId: string | null;
  maquina: { id: string; nombre: string; plantilla: string | null } | null;
  perfilOperativo: { id: string; nombre: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type ProcesoOperacionAlternativaPayload = {
  maquinaId: string;
  perfilOperativoId?: string | null;
  label: string;
  esDefault?: boolean;
  orden?: number;
  activo?: boolean;
};

export async function listProcesoOperacionAlternativas(operacionId: string) {
  return apiRequest<ProcesoOperacionAlternativa[]>(
    `/procesos/operaciones/${operacionId}/alternativas`,
  );
}

export async function createProcesoOperacionAlternativa(
  operacionId: string,
  payload: ProcesoOperacionAlternativaPayload,
) {
  return apiRequest<ProcesoOperacionAlternativa>(
    `/procesos/operaciones/${operacionId}/alternativas`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export async function updateProcesoOperacionAlternativa(
  operacionId: string,
  alternativaId: string,
  payload: ProcesoOperacionAlternativaPayload,
) {
  return apiRequest<ProcesoOperacionAlternativa>(
    `/procesos/operaciones/${operacionId}/alternativas/${alternativaId}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  );
}

export async function deleteProcesoOperacionAlternativa(
  operacionId: string,
  alternativaId: string,
) {
  return apiRequest<{ ok: true }>(
    `/procesos/operaciones/${operacionId}/alternativas/${alternativaId}`,
    { method: 'DELETE' },
  );
}
