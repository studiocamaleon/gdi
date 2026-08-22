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

export type ConfiguracionPlantillaInstalacion = {
  bordeMm: number;
  anchoPanelMm: number;
  altoPanelMm: number;
  solapeMm: number;
};

export type PlantillaInstalacion = {
  schemaVersion: 1;
  nombreArchivo: string;
  anchoDisenoMm: number;
  altoDisenoMm: number;
  anchoPlantillaMm: number;
  altoPlantillaMm: number;
  bordeMm: number;
  cantidadPiezas: number;
  cantidadUniones: number;
  previewSvg: string;
  paneles: Array<{
    indice: number;
    fila: number;
    columna: number;
    origenXmm: number;
    origenYmm: number;
    anchoMm: number;
    altoMm: number;
  }>;
};

export function getPlantillaInstalacion(
  itemId: string,
  config: ConfiguracionPlantillaInstalacion,
) {
  return apiRequest<PlantillaInstalacion>(
    `/recorridos-vectoriales/items/${itemId}/plantilla-instalacion?${templateParams(config)}`,
  );
}

export function descargaPlantillaInstalacionHref(
  itemId: string,
  config: ConfiguracionPlantillaInstalacion,
  panel?: number,
) {
  const params = templateParams(config);
  if (panel != null) params.set("panel", String(panel));
  return `/api/backend/recorridos-vectoriales/items/${itemId}/plantilla-instalacion/descargar?${params}`;
}

export type FormatoArchivoInstalacion =
  | "paquete"
  | "plano-pdf"
  | "papel-plotter-pdf"
  | "papel-mosaico-pdf"
  | "rigida-dxf"
  | "vinilo-eps"
  | "pounce-dxf";

export function descargaArchivoInstalacionHref(
  itemId: string,
  config: ConfiguracionPlantillaInstalacion,
  formato: FormatoArchivoInstalacion,
  panel?: number,
) {
  const params = templateParams(config);
  if (panel != null) params.set("panel", String(panel));
  return `/api/backend/recorridos-vectoriales/items/${itemId}/plantilla-instalacion/archivos/${formato}?${params}`;
}

function templateParams(config: ConfiguracionPlantillaInstalacion) {
  return new URLSearchParams({
    bordeMm: String(config.bordeMm),
    anchoPanelMm: String(config.anchoPanelMm),
    altoPanelMm: String(config.altoPanelMm),
    solapeMm: String(config.solapeMm),
  });
}
