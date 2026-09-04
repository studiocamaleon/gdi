export type ModoGeometriaComercial = "RECTANGULAR" | "VECTORIAL" | "AMBAS";

export type FuenteGeometriaComercial = {
  id: string;
  nombre: string;
  requerida: boolean;
};

export type ConfiguracionGeometriasComerciales = {
  version: 1;
  modo: ModoGeometriaComercial;
  fuentes: FuenteGeometriaComercial[];
  permitirCotizacionManual: boolean;
};

export type EjeEscalaVectorial = "ancho" | "alto";

export function obtenerRelacionAspectoSvg(svg?: string): number {
  if (!svg) return 1;
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!root) return 1;
  const viewBox = root.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (viewBox) {
    const values = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const width = values[2];
    const height = values[3];
    if (
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
    ) {
      return height / width;
    }
  }
  const dimension = (name: "width" | "height") => {
    const raw = root.match(
      new RegExp(`\\b${name}\\s*=\\s*["']([0-9]*\\.?[0-9]+)`, "i"),
    )?.[1];
    return raw ? Number(raw) : 0;
  };
  const width = dimension("width");
  const height = dimension("height");
  return width > 0 && height > 0 ? height / width : 1;
}

export function escalarGeometriaProporcional(
  relacionAltoAncho: number,
  eje: EjeEscalaVectorial,
  medidaMm: number,
): { anchoFinalMm: number; altoFinalMm: number } {
  const relacion = relacionAltoAncho > 0 ? relacionAltoAncho : 1;
  const medida = Math.max(1, medidaMm);
  return eje === "ancho"
    ? { anchoFinalMm: medida, altoFinalMm: medida * relacion }
    : { anchoFinalMm: medida / relacion, altoFinalMm: medida };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function getGeometriasComerciales(
  atributos: Record<string, unknown> | null | undefined,
): ConfiguracionGeometriasComerciales {
  const raw = record(record(atributos).geometriasComerciales);
  const modo: ModoGeometriaComercial = [
    "RECTANGULAR",
    "VECTORIAL",
    "AMBAS",
  ].includes(String(raw.modo))
    ? (raw.modo as ModoGeometriaComercial)
    : "RECTANGULAR";
  const fuentes = Array.isArray(raw.fuentes)
    ? raw.fuentes.flatMap((item) => {
        const fuente = record(item);
        const id = typeof fuente.id === "string" ? fuente.id.trim() : "";
        const nombre =
          typeof fuente.nombre === "string" ? fuente.nombre.trim() : "";
        return /^[a-z0-9][a-z0-9_-]{0,59}$/.test(id) && nombre
          ? [{ id, nombre, requerida: fuente.requerida !== false }]
          : [];
      })
    : [];
  return {
    version: 1,
    modo,
    fuentes,
    permitirCotizacionManual: raw.permitirCotizacionManual === true,
  };
}

export function tieneGeometriasComercialesConfiguradas(
  atributos: Record<string, unknown> | null | undefined,
): boolean {
  const raw = record(atributos).geometriasComerciales;
  return Boolean(raw && typeof raw === "object" && !Array.isArray(raw));
}

export function setGeometriasComerciales(
  atributos: Record<string, unknown> | null | undefined,
  configuracion: ConfiguracionGeometriasComerciales,
): Record<string, unknown> {
  return {
    ...record(atributos),
    geometriasComerciales: configuracion,
  };
}

export function nuevaFuenteGeometria(
  existentes: FuenteGeometriaComercial[],
): FuenteGeometriaComercial {
  let index = existentes.length + 1;
  let id = index === 1 ? "principal" : `diseno_${index}`;
  const usados = new Set(existentes.map((item) => item.id));
  while (usados.has(id)) {
    index += 1;
    id = `diseno_${index}`;
  }
  return {
    id,
    nombre: index === 1 ? "Diseño principal" : `Diseño ${index}`,
    requerida: true,
  };
}
