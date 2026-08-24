import type { NestingViewerInput } from "@/lib/productos-servicios-api";

export type FuenteVectorialPersistida = {
  schemaVersion: 1 | 2;
  nombreArchivo: string;
  svg: string;
  anchoFinalMm: number;
  altoFinalMm?: number;
};

type Punto = { x: number; y: number };
type Contorno = { esHueco?: boolean; puntos: Punto[] };

export function obtenerFuenteVectorial(
  jobContext: Record<string, unknown> | undefined,
): FuenteVectorialPersistida | null {
  const value = jobContext?.disenoVectorialFuente;
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<FuenteVectorialPersistida>;
  if (
    (source.schemaVersion !== 1 && source.schemaVersion !== 2) ||
    typeof source.nombreArchivo !== "string" ||
    typeof source.svg !== "string" ||
    typeof source.anchoFinalMm !== "number"
  )
    return null;
  return source as FuenteVectorialPersistida;
}

export function crearSvgDePlaca(
  result: NestingViewerInput,
  substrateIndex: number,
): string {
  const substrate = result.substrates[substrateIndex];
  if (!substrate || substrate.kind !== "sheet")
    throw new Error("La placa seleccionada no existe.");

  const paths = result.placements
    .filter((placement) => (placement.substrateIndex ?? 0) === substrateIndex)
    .flatMap((placement, placementIndex) => {
      const meta = placement.meta as
        { contornos?: Contorno[]; cortesInternos?: Contorno[] } | undefined;
      return [...(meta?.contornos ?? []), ...(meta?.cortesInternos ?? [])].map(
        (contorno, contourIndex) => {
          const d = puntosAPath(contorno.puntos);
          if (!d) return "";
          return `    <path id="${xmlAttr(placement.pieceId)}-${placementIndex + 1}-${contourIndex + 1}" d="${d}" />`;
        },
      );
    })
    .filter(Boolean)
    .join("\n");

  if (!paths)
    throw new Error("El nesting no contiene geometría vectorial exportable.");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${numero(substrate.widthMm)}mm" height="${numero(substrate.heightMm)}mm" viewBox="0 0 ${numero(substrate.widthMm)} ${numero(substrate.heightMm)}">`,
    `  <title>Placa ${substrateIndex + 1} · nesting de corte</title>`,
    '  <g id="corte" fill="none" stroke="#000000" stroke-width="0.1" stroke-linejoin="miter" stroke-linecap="square" vector-effect="non-scaling-stroke">',
    paths,
    "  </g>",
    "</svg>",
  ].join("\n");
}

export function descargarTexto(
  contenido: string,
  nombreArchivo: string,
  mime = "image/svg+xml;charset=utf-8",
): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = nombreArchivo;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function nombreBaseSvg(nombreArchivo: string): string {
  const safe = nombreArchivo
    .replace(/\.svg$/i, "")
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe || "nesting";
}

function puntosAPath(points: Punto[]): string {
  if (!Array.isArray(points) || points.length < 3) return "";
  return `${points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${numero(point.x)} ${numero(point.y)}`,
    )
    .join(" ")} Z`;
}

function numero(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function xmlAttr(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => {
    const escaped: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return escaped[char];
  });
}
