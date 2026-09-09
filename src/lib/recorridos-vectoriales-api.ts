import { apiRequest } from "@/lib/api";

export type SeleccionRecorrido = {
  rutaComponentes?: string[];
  rutaPasoId?: string;
  fuenteId?: string;
};

function seleccionParams(seleccion?: SeleccionRecorrido) {
  const params = new URLSearchParams();
  if (seleccion?.rutaComponentes?.length) params.set("componentes", JSON.stringify(seleccion.rutaComponentes));
  if (seleccion?.rutaPasoId) params.set("paso", seleccion.rutaPasoId);
  if (seleccion?.fuenteId) params.set("fuente", seleccion.fuenteId);
  return params;
}

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
  copias?: number;
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

export function getPreparacionesRecorridoCorte(itemId: string, seleccion?: SeleccionRecorrido) {
  return apiRequest<PreparacionRecorridoCorte[]>(
    `/recorridos-vectoriales/items/${itemId}/corte/preparar?${seleccionParams(seleccion)}`,
    { method: "POST" },
  );
}

export function regenerarPreparacionesRecorridoCorte(itemId: string, seleccion?: SeleccionRecorrido) {
  return apiRequest<PreparacionRecorridoCorte[]>(
    `/recorridos-vectoriales/items/${itemId}/corte/regenerar?${seleccionParams(seleccion)}`,
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
  fuentes: Array<{ id: string; nombre: string }>;
  fuenteId: string;
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
  seleccion?: SeleccionRecorrido,
) {
  return apiRequest<PlantillaInstalacion>(
    `/recorridos-vectoriales/items/${itemId}/plantilla-instalacion?${templateParams(config, seleccion)}`,
  );
}

export function descargaPlantillaInstalacionHref(
  itemId: string,
  config: ConfiguracionPlantillaInstalacion,
  panel?: number,
  seleccion?: SeleccionRecorrido,
) {
  const params = templateParams(config, seleccion);
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
  seleccion?: SeleccionRecorrido,
) {
  const params = templateParams(config, seleccion);
  if (panel != null) params.set("panel", String(panel));
  return `/api/backend/recorridos-vectoriales/items/${itemId}/plantilla-instalacion/archivos/${formato}?${params}`;
}

function templateParams(config: ConfiguracionPlantillaInstalacion, seleccion?: SeleccionRecorrido) {
  return new URLSearchParams({
    ...Object.fromEntries(seleccionParams(seleccion)),
    bordeMm: String(config.bordeMm),
    anchoPanelMm: String(config.anchoPanelMm),
    altoPanelMm: String(config.altoPanelMm),
    solapeMm: String(config.solapeMm),
  });
}
