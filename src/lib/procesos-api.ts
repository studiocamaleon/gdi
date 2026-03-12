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
  return apiRequest<Proceso[]>('/procesos');
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
