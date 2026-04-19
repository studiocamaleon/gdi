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

// P1.4 — ProcesoOperacionMaterial: materiales declarativos por paso.
export const MATERIAL_FORMULAS = [
  'por_unidad_productiva',
  'por_m2',
  'por_pieza',
  'por_metro_lineal',
  'fijo',
] as const;
export type MaterialFormula = (typeof MATERIAL_FORMULAS)[number];

export type ProcesoOperacionMaterial = {
  id: string;
  procesoOperacionId: string;
  materiaPrimaVarianteId: string | null;
  nombre: string;
  formula: MaterialFormula;
  cantidadPorUnidad: number;
  unidad: string;
  precioManual: number | null;
  aplicaMultiCaras: boolean;
  orden: number;
  activo: boolean;
  materiaPrimaVariante: {
    id: string;
    sku: string;
    nombreVariante: string | null;
    precioReferencia: number | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type ProcesoOperacionMaterialPayload = {
  nombre: string;
  materiaPrimaVarianteId?: string | null;
  formula: MaterialFormula;
  cantidadPorUnidad: number;
  unidad: string;
  precioManual?: number | null;
  aplicaMultiCaras?: boolean;
  orden?: number;
  activo?: boolean;
};

export async function listProcesoOperacionMateriales(operacionId: string) {
  return apiRequest<ProcesoOperacionMaterial[]>(
    `/procesos/operaciones/${operacionId}/materiales`,
  );
}

export async function createProcesoOperacionMaterial(
  operacionId: string,
  payload: ProcesoOperacionMaterialPayload,
) {
  return apiRequest<ProcesoOperacionMaterial>(
    `/procesos/operaciones/${operacionId}/materiales`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

export async function updateProcesoOperacionMaterial(
  operacionId: string,
  materialId: string,
  payload: ProcesoOperacionMaterialPayload,
) {
  return apiRequest<ProcesoOperacionMaterial>(
    `/procesos/operaciones/${operacionId}/materiales/${materialId}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  );
}

export async function deleteProcesoOperacionMaterial(
  operacionId: string,
  materialId: string,
) {
  return apiRequest<{ ok: true }>(
    `/procesos/operaciones/${operacionId}/materiales/${materialId}`,
    { method: 'DELETE' },
  );
}

// P1.5 — Update parcial de un paso (ProcesoOperacion) y reorden.
export type UpdateProcesoOperacionPayload = {
  nombre?: string;
  esOpcional?: boolean;
  activacionV2?: 'OBLIGATORIO' | 'OPCIONAL' | 'CONDICIONAL';
  familiaV2?: string;
  unidadProductivaV2?: string;
  centroCostoId?: string;
  maquinaId?: string | null;
  perfilOperativoId?: string | null;
  setupMin?: number;
  cleanupMin?: number;
  tiempoFijoMin?: number;
  productividadBase?: number;
};

export async function updateProcesoOperacion(
  operacionId: string,
  payload: UpdateProcesoOperacionPayload,
) {
  return apiRequest<unknown>(
    `/procesos/operaciones/${operacionId}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  );
}

export async function moveProcesoOperacion(
  operacionId: string,
  direction: 'up' | 'down',
) {
  return apiRequest<{ ok: true; moved: { id: string; fromOrden: number; toOrden: number } }>(
    `/procesos/operaciones/${operacionId}/move?direction=${direction}`,
    { method: 'POST' },
  );
}
