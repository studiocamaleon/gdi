import { apiRequest } from "@/lib/api";

export type CampanaEstado =
  "borrador" | "activo" | "pausado" | "completado" | "cancelado";
export type CampanaPrioridad = "baja" | "normal" | "alta" | "critica";
export type HitoEstado = "pendiente" | "en_curso" | "completado" | "cancelado";

export type CampanaReferencia = {
  id: string;
  codigo: string;
  nombre: string;
  estado: CampanaEstado;
  clienteId: string;
};

export type CampanaResumen = {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string | null;
  estado: CampanaEstado;
  prioridad: CampanaPrioridad;
  fechaInicio: string | null;
  fechaObjetivo: string | null;
  updatedAt: string;
  cliente: { id: string; nombre: string };
  responsable: { id: string; nombre: string } | null;
  avancePct: number | null;
  riesgo: boolean;
  cantidad: { cotizaciones: number; ordenes: number; hitos: number };
};

export type CampanasListado = {
  data: CampanaResumen[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  stats: {
    porEstado: Partial<Record<CampanaEstado, number>>;
    enRiesgo: number;
    proximasAVencer: number;
  };
};

export type CampanaDetalle = Omit<
  CampanaResumen,
  "avancePct" | "riesgo" | "cantidad"
> & {
  descripcion: string | null;
  fechaCompletada: string | null;
  observaciones: string | null;
  createdAt: string;
  equipo: Array<{
    id: string;
    empleadoId: string;
    nombre: string;
    funcion: string | null;
  }>;
  hitos: Array<{
    id: string;
    titulo: string;
    descripcion: string | null;
    estado: HitoEstado;
    fechaObjetivo: string | null;
    completadoEl: string | null;
    notas: string | null;
    orden: number;
    updatedAt: string;
    responsable: { id: string; nombre: string } | null;
  }>;
  cotizaciones: Array<{
    id: string;
    numero: string | null;
    estado: string;
    total: number;
    fechaEmision: string | null;
    createdAt: string;
  }>;
  ordenes: Array<{
    id: string;
    numero: string;
    estado: string;
    total: number;
    facturadoTotal: number;
    cobradoTotal: number;
    progresoPct: number | null;
    fechaEntrega: string | null;
    createdAt: string;
  }>;
  archivos: Array<{
    id: string;
    nombre: string;
    mimeType: string;
    bytes: number;
    descripcion: string | null;
    createdAt: string;
    subidoPor: string | null;
  }>;
  eventos: Array<{
    id: string;
    fecha: string;
    tipo: string;
    descripcion: string;
    actor: string;
    origen: string;
    datos: unknown;
  }>;
  dashboard: {
    comercial: {
      presupuestado: number;
      vendido: number;
      facturado: number;
      cobrado: number;
    };
    produccion: {
      avancePct: number | null;
      porEstado: Record<string, number>;
      abiertas: number;
    };
    hitos: { porEstado: Record<string, number>; vencidos: number };
    entregas: { entregadas: number; vencidas: number };
    materiales: { disponible: false; mensaje: string };
    rentabilidad?: {
      disponible: boolean;
      costoEstimado: number;
      margenEstimado: number;
      margenPct: number | null;
      parcial: boolean;
      mensaje: string;
    };
  };
  senalesCierre: { ordenesAbiertas: number; hitosPendientes: number };
};

export type CampanaPayload = {
  clienteId: string;
  nombre: string;
  descripcion?: string;
  tipo?: string;
  prioridad?: CampanaPrioridad;
  fechaInicio?: string;
  fechaObjetivo?: string;
  responsableEmpleadoId?: string;
  observaciones?: string;
  equipo?: Array<{ empleadoId: string; funcion?: string }>;
  hitos?: HitoPayload[];
};

export type HitoPayload = {
  titulo: string;
  descripcion?: string;
  responsableEmpleadoId?: string;
  fechaObjetivo?: string;
  estado?: HitoEstado;
  notas?: string;
  orden?: number;
};

export function listarCampanas(filtros?: {
  q?: string;
  clienteId?: string;
  estado?: CampanaEstado;
  prioridad?: CampanaPrioridad;
  responsableEmpleadoId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page?: number;
  limit?: number;
}) {
  const params = new URLSearchParams();
  Object.entries(filtros ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return apiRequest<CampanasListado>(
    `/campanas${params.size ? `?${params.toString()}` : ""}`,
  );
}

export function getCampana(id: string) {
  return apiRequest<CampanaDetalle>(`/campanas/${id}`);
}

export function getCampanasOpciones(clienteId?: string, q?: string) {
  const params = new URLSearchParams();
  if (clienteId) params.set("clienteId", clienteId);
  if (q) params.set("q", q);
  return apiRequest<CampanaReferencia[]>(
    `/campanas/opciones${params.size ? `?${params.toString()}` : ""}`,
  );
}

export function crearCampana(payload: CampanaPayload) {
  return apiRequest<CampanaDetalle>("/campanas", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function editarCampana(
  id: string,
  payload: Partial<
    Omit<
      CampanaPayload,
      | "clienteId"
      | "equipo"
      | "hitos"
      | "descripcion"
      | "tipo"
      | "observaciones"
      | "responsableEmpleadoId"
      | "fechaInicio"
      | "fechaObjetivo"
    >
  > & {
    updatedAt: string;
    descripcion?: string | null;
    tipo?: string | null;
    observaciones?: string | null;
    responsableEmpleadoId?: string | null;
    fechaInicio?: string | null;
    fechaObjetivo?: string | null;
  },
) {
  return apiRequest<CampanaDetalle>(`/campanas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function cambiarEstadoCampana(
  id: string,
  estado: CampanaEstado,
  updatedAt: string,
) {
  return apiRequest<CampanaDetalle>(`/campanas/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado, updatedAt }),
  });
}

export function crearHitoCampana(id: string, payload: HitoPayload) {
  return apiRequest<CampanaDetalle>(`/campanas/${id}/hitos`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function editarHitoCampana(
  id: string,
  hitoId: string,
  payload: Record<string, unknown> & { updatedAt: string },
) {
  return apiRequest<CampanaDetalle>(`/campanas/${id}/hitos/${hitoId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function reemplazarEquipoCampana(
  id: string,
  equipo: Array<{ empleadoId: string; funcion?: string }>,
) {
  return apiRequest<CampanaDetalle>(`/campanas/${id}/equipo`, {
    method: "PUT",
    body: JSON.stringify({ equipo }),
  });
}

export function vincularDocumentoCampana(
  id: string,
  tipo: "cotizaciones" | "ordenes",
  documentoId: string,
) {
  return apiRequest<CampanaDetalle>(`/campanas/${id}/${tipo}/${documentoId}`, {
    method: "POST",
  });
}

export function desvincularDocumentoCampana(
  id: string,
  tipo: "cotizaciones" | "ordenes",
  documentoId: string,
) {
  return apiRequest<CampanaDetalle>(`/campanas/${id}/${tipo}/${documentoId}`, {
    method: "DELETE",
  });
}
