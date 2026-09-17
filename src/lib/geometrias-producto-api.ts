import { apiRequest } from "./api";
import type { FabricacionVectorial } from "./fabricacion-vectorial";
export type Punto = { x: number; y: number };
export type EntidadInspeccion = {
  id: string;
  tipoEntidad?: string;
  color?: string;
  tipoLinea?: string;
  exportable?: boolean;
  motivoNoCompatible?: string;
  longitud?: number | null;
  precisionLongitud?: "EXACTA" | "APROXIMADA" | null;
  texto?: {
    contenido: string;
    x: number;
    y: number;
    altura: number;
    rotacion: number;
  };
  capa: string;
  puntos: Punto[];
  cerrada: boolean;
  apertura: number;
  area: number;
  ancho: number;
  alto: number;
};
export type InspeccionVector = {
  formato: "DXF" | "SVG";
  dxfNativo?: boolean;
  unidadDeclarada: string | null;
  entidades: EntidadInspeccion[];
  sugeridaId: string;
  piezas?: Array<{ exteriorId: string; interioresIds: string[] }>;
  piezasSugeridas?: string[];
  avisos: string[];
};
export type SeleccionVector = {
  exteriorId: string;
  exteriorIds?: string[];
  unidad: string;
  cerrarExterior: boolean;
  excluidas?: string[];
  operaciones: Array<{
    entidadId: string;
    tipo: "CORTE_INTERIOR" | "CORTE_PARCIAL" | "HENDIDO";
  }>;
};
export type FuenteGuardada = {
  schemaVersion: 2;
  fabricacion?: FabricacionVectorial;
  nombreArchivo: string;
  svg: string;
  anchoFinalMm: number;
  altoFinalMm: number;
  relacionAltoAncho: number;
  formatoOrigen: "DXF" | "SVG";
  unidadOrigen: string;
  procedencia: {
    version: 1;
    geometriaId: string;
    archivoId: string;
    hash: string;
    capa: string;
    exteriorId: string;
    entidadesExcluidas?: string[];
    unidadDeclarada: string | null;
    cierreConfirmado: boolean;
    aperturaOriginalMm: number;
  };
  operaciones: Array<{
    entidadId: string;
    capa: string;
    tipo: "CORTE_INTERIOR" | "CORTE_PARCIAL" | "HENDIDO";
    puntos: Punto[];
    cerrada: boolean;
  }>;
};

export function inspeccionarArchivoProducto(
  productoId: string,
  archivoId: string,
) {
  return apiRequest<InspeccionVector>(
    `/productos-servicios/productos/${productoId}/geometrias/inspeccionar`,
    {
      method: "POST",
      body: JSON.stringify({ archivoId }),
    },
  );
}
export function guardarInterpretacionProducto(
  productoId: string,
  archivoId: string,
  seleccion: SeleccionVector,
) {
  return apiRequest<FuenteGuardada>(
    `/productos-servicios/productos/${productoId}/geometrias/interpretaciones`,
    {
      method: "POST",
      body: JSON.stringify({ archivoId, ...seleccion }),
    },
  );
}

export function guardarInterpretacionesProducto(
  productoId: string,
  archivoId: string,
  seleccion: SeleccionVector,
) {
  return apiRequest<{ fuentes: FuenteGuardada[] }>(
    `/productos-servicios/productos/${productoId}/geometrias/interpretaciones-lote`,
    { method: "POST", body: JSON.stringify({ archivoId, ...seleccion }) },
  );
}
