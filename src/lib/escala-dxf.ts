import type { FuenteVectorialNormalizada } from "./productos-servicios-api";

export const UNIDADES_IMPORTACION_DXF = [
  { value: "mm", label: "Milímetros (mm)", factorMm: 1 },
  { value: "cm", label: "Centímetros (cm)", factorMm: 10 },
  { value: "m", label: "Metros (m)", factorMm: 1000 },
  { value: "pulgadas", label: "Pulgadas", factorMm: 25.4 },
  { value: "pies", label: "Pies", factorMm: 304.8 },
  { value: "pt", label: "Puntos tipográficos (pt)", factorMm: 25.4 / 72 },
] as const;

export type ImportacionDxf = {
  anchoUnidades: number;
  altoUnidades: number;
  unidadDetectada: string | null;
  mensajes: string[];
};

export function registrarImportacionDxf(
  normalizada: FuenteVectorialNormalizada,
): ImportacionDxf | undefined {
  if (normalizada.formatoOrigen !== "DXF" || !normalizada.medidasOriginales)
    return;
  return {
    anchoUnidades: normalizada.medidasOriginales.ancho,
    altoUnidades: normalizada.medidasOriginales.alto,
    unidadDetectada: normalizada.unidadDetectada,
    mensajes: normalizada.diagnosticos
      .filter((d) => d.codigo !== "dxf_unidad_no_declarada")
      .map((d) => d.mensaje),
  };
}

export function medidasDxfEnUnidad(
  importacion: ImportacionDxf,
  unidad: string,
) {
  const factor = UNIDADES_IMPORTACION_DXF.find(
    (item) => item.value === unidad,
  )?.factorMm;
  if (!factor) return null;
  return {
    anchoFinalMm: importacion.anchoUnidades * factor,
    altoFinalMm: importacion.altoUnidades * factor,
    unidadOrigen: unidad,
  };
}
