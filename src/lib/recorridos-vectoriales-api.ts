import { apiRequest } from "@/lib/api";

export type PuntoRecorridoCorte = {
  x: number;
  y: number;
  via: "origin" | "bridge" | "contour";
  contourId?: string;
  bridgeId?: string;
};

export type PreparacionRecorridoCorte = {
  id: string;
  placaIndice: number;
  revision: number;
  estado:
    "BORRADOR" | "REVISADA" | "APROBADA" | "ENVIADA_MAQUINA" | "REEMPLAZADA";
  nombreArchivo: string;
  linkedSvg: string;
  route: {
    svg: PuntoRecorridoCorte[];
    machine: PuntoRecorridoCorte[];
    originSvg: { x: number; y: number };
    bridges: unknown[];
  };
  report: {
    svgWorkArea?: { widthMm?: number; heightMm?: number };
    warnings?: string[];
  };
  metricas: {
    longitudContornosMm: number;
    longitudConexionesIdaMm: number;
    longitudConexionesRecorridaMm: number;
    longitudTotalMm: number;
    tiempoEstimadoSeg: number;
    cantidadContornos: number;
    cantidadPiezas: number;
    cantidadConexiones: number;
  };
  perfilMaquina: {
    id: string;
    nombre: string;
    velocidadMmMin: number;
    anchoUtilMm: number;
    altoUtilMm: number;
  };
  createdAt: string;
  updatedAt: string;
};

export function getPreparacionesRecorridoCorte(itemId: string) {
  return apiRequest<PreparacionRecorridoCorte[]>(
    `/recorridos-vectoriales/items/${itemId}/corte/preparar`,
    { method: "POST" },
  );
}

export function regenerarPreparacionesRecorridoCorte(itemId: string) {
  return apiRequest<PreparacionRecorridoCorte[]>(
    `/recorridos-vectoriales/items/${itemId}/corte/regenerar`,
    { method: "POST" },
  );
}

export function cambiarEstadoPreparacionCorte(
  revisionId: string,
  estado: "REVISADA" | "APROBADA" | "ENVIADA_MAQUINA",
) {
  return apiRequest<{
    id: string;
    estado: PreparacionRecorridoCorte["estado"];
  }>(`/recorridos-vectoriales/revisiones/${revisionId}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado }),
  });
}

export function descargaPreparacionHref(
  revisionId: string,
  format: "tap" | "source-svg" | "linked-svg",
) {
  return `/api/backend/recorridos-vectoriales/revisiones/${revisionId}/${format}`;
}
