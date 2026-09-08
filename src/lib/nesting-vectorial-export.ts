import { apiRequest } from "./api";
import {
  fabricacionDePlacement,
  recorridosEnPlaca,
  completarFabricacionNesting,
} from "./fabricacion-export";
import Drawing from "dxf-writer";
import type { NestingViewerInput } from "@/lib/productos-servicios-api";

export type FuenteVectorialPersistida = {
  schemaVersion: 1 | 2;
  nombreArchivo: string;
  svg: string;
  anchoFinalMm: number;
  altoFinalMm?: number;
  formatoOrigen?: "SVG" | "DXF";
  unidadOrigen?: string | null;
};

type Punto = { x: number; y: number };
type Contorno = { esHueco?: boolean; puntos: Punto[] };
type TrazoDxf = (drawing: Drawing) => void;

type RecorridoExportable = {
  entidadId: string;
  capa: string;
  tipo: string;
  puntos: Punto[];
  cerrada: boolean;
  color?: string;
  texto?: import("./fabricacion-vectorial").RecorridoFabricacion["texto"];
};

function operacionesDePlaca(result: NestingViewerInput, indice: number) {
  return result.placements
    .filter((p) => (p.substrateIndex ?? 0) === indice)
    .flatMap<RecorridoExportable>((p) => {
      const documento = fabricacionDePlacement(p);
      if (documento)
        return recorridosEnPlaca(documento)
          .filter((e) => e.rol !== "CORTE_EXTERIOR")
          .map((e) => ({ ...e, tipo: e.rol ?? "SIN_OPERACION" }));
      const ops =
        (
          p.meta as
            | {
                operaciones?: import("./geometrias-producto-api").FuenteGuardada["operaciones"];
              }
            | undefined
        )?.operaciones ?? [];
      return ops.map((op) => ({
        ...op,
        color: undefined as string | undefined,
        texto:
          undefined as import("./fabricacion-vectorial").RecorridoFabricacion["texto"],
      }));
    });
}
function operacionesSvg(result: NestingViewerInput, indice: number) {
  return operacionesDePlaca(result, indice)
    .map((op, i) => {
      const d =
        op.puntos
          .map((p, j) => `${j ? "L" : "M"}${numero(p.x)},${numero(p.y)}`)
          .join(" ") + (op.cerrada ? " Z" : "");
      const color = xmlAttr(
        op.color ?? (op.tipo === "HENDIDO" ? "#008000" : "#0000ff"),
      );
      const texto = op.texto;
      return `<g data-capa="${xmlAttr(op.capa ?? op.tipo)}" data-entidad="${xmlAttr(op.entidadId ?? String(i))}" data-operacion="${op.tipo}" fill="none" stroke="${color}" stroke-width="0.1">${
        texto
          ? `<text x="${numero(texto.x)}" y="${numero(texto.y)}" font-size="${numero(texto.altura)}" fill="${color}" stroke="none" transform="rotate(${numero(texto.rotacion)} ${numero(texto.x)} ${numero(texto.y)})">${xmlAttr(texto.contenido)}</text>`
          : `<path id="operacion-${i}" d="${d}" />`
      }</g>`;
    })
    .join("\n");
}
function operacionesDxf(
  result: NestingViewerInput,
  indice: number,
  altoMm: number,
) {
  return operacionesDePlaca(result, indice).flatMap((op) =>
    op.puntos.flatMap((p, i) => {
      if (i === op.puntos.length - 1 && !op.cerrada) return [];
      return [
        dxfLine(
          p,
          op.puntos[(i + 1) % op.puntos.length],
          altoMm,
          op.capa ?? op.tipo,
        ),
      ];
    }),
  );
}

/** Recupera las entidades CAD de la interpretación autorizada. Nunca degrada
 * silenciosamente a segmentos si el original no está disponible. */
export async function crearDxfFabricacionDePlaca(
  original: NestingViewerInput,
  indice: number,
): Promise<string> {
  const result = await completarFabricacionNesting(original);
  const placa = result.substrates[indice];
  if (!placa || placa.kind !== "sheet")
    throw new Error("La placa seleccionada no existe.");
  const instancias = result.placements
    .filter((p) => (p.substrateIndex ?? 0) === indice)
    .flatMap((p) => {
      const f = fabricacionDePlacement(p);
      const meta = p.meta as { label?: unknown; propietario?: { piezaNombre?: string } } | undefined;
      const label = meta?.propietario?.piezaNombre ?? meta?.label;
      return f?.dxfNativo
        ? [
            {
              geometriaId: f.geometriaId,
              archivoHash: f.archivoHash,
              ...(typeof label === "string" && label.trim() ? { nombrePieza: label.trim().slice(0, 160) } : {}),
              transformacion: f.transformacion,
              soloComplementos: !!result.commonLine?.aplicado,
            },
          ]
        : [];
    });
  if (!instancias.length) return crearDxfDePlaca(result, indice);
  const base: NestingViewerInput = {
    ...result,
    placements: result.placements.map((p) => {
      if (!fabricacionDePlacement(p)?.dxfNativo) return p;
      return {
        ...p,
        meta: {
          ...(p.meta as Record<string, unknown> | undefined),
          fabricacion: undefined,
          operaciones: [],
          ...(!result.commonLine?.aplicado
            ? { contornos: [], cortesInternos: [] }
            : {}),
        },
      };
    }),
  };
  const respuesta = await apiRequest<{ dxf: string }>(
    "/productos-servicios/geometrias/exportar-dxf",
    {
      method: "POST",
      body: JSON.stringify({
        baseDxf: crearDxfDePlaca(base, indice, true),
        altoMm: placa.heightMm,
        instancias,
      }),
    },
  );
  return respuesta.dxf;
}

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

  if (result.commonLine?.aplicado) {
    return crearSvgCommonLine(result, substrateIndex, substrate);
  }

  const paths = result.placements
    .filter((placement) => (placement.substrateIndex ?? 0) === substrateIndex)
    .flatMap((placement, placementIndex) => {
      const meta = placement.meta as
        | { contornos?: Contorno[]; cortesInternos?: Contorno[] }
        | undefined;
      return [...(meta?.contornos ?? []), ...(meta?.cortesInternos ?? [])].map(
        (contorno, contourIndex) => {
          const d = puntosAPath(contorno.puntos);
          if (!d) return "";
          const exterior = fabricacionDePlacement(placement)?.entidades.find(
            (e) => e.rol === "CORTE_EXTERIOR",
          );
          return `    <path data-capa="${xmlAttr(exterior?.capa ?? "CORTE")}" id="${xmlAttr(placement.pieceId)}-${placementIndex + 1}-${contourIndex + 1}" d="${d}" />`;
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
    operacionesSvg(result, substrateIndex),
    "</svg>",
  ].join("\n");
}

/** DXF ASCII por placa para intercambio con LightBurn y software CAM.
 * Mantiene los contornos sin compensación de kerf/herramienta: esa decisión
 * pertenece al perfil y al software de la máquina, no al nesting comercial. */
export function crearDxfDePlaca(
  result: NestingViewerInput,
  substrateIndex: number,
  permitirVacio = false,
): string {
  if (
    result.placements.some(
      (p) =>
        (p.substrateIndex ?? 0) === substrateIndex &&
        fabricacionDePlacement(p)?.dxfNativo,
    )
  )
    throw new Error(
      "Este diseño requiere la exportación CAD con sus capas originales.",
    );
  const substrate = result.substrates[substrateIndex];
  if (!substrate || substrate.kind !== "sheet")
    throw new Error("La placa seleccionada no existe.");

  if (result.commonLine?.aplicado) {
    return crearDxfCommonLine(result, substrateIndex, substrate);
  }

  const polilineas = result.placements
    .filter((placement) => (placement.substrateIndex ?? 0) === substrateIndex)
    .flatMap((placement) => {
      const meta = placement.meta as
        | { contornos?: Contorno[]; cortesInternos?: Contorno[] }
        | undefined;
      return [...(meta?.contornos ?? []), ...(meta?.cortesInternos ?? [])];
    })
    .filter(
      (contorno) =>
        Array.isArray(contorno.puntos) && contorno.puntos.length >= 3,
    )
    .map((contorno) => dxfPolyline(contorno.puntos, substrate.heightMm));

  if (polilineas.length === 0 && !permitirVacio)
    throw new Error("El nesting no contiene geometría vectorial exportable.");

  return escribirDxf([
    ...polilineas,
    ...operacionesDxf(result, substrateIndex, substrate.heightMm),
  ]);
}

function crearSvgCommonLine(
  result: NestingViewerInput,
  substrateIndex: number,
  substrate: {
    kind: "sheet";
    count: number;
    widthMm: number;
    heightMm: number;
  },
): string {
  const removidos = segmentosReemplazados(result, substrateIndex);
  const paths: string[] = [];
  result.placements.forEach((placement, placementIndex) => {
    if ((placement.substrateIndex ?? 0) !== substrateIndex) return;
    const meta = placement.meta as
      | {
          contornos?: Contorno[];
          cortesInternos?: Contorno[];
          copiaIndex?: number;
        }
      | undefined;
    const copyIndex = meta?.copiaIndex;
    [...(meta?.contornos ?? []), ...(meta?.cortesInternos ?? [])].forEach(
      (contorno, contourIndex) => {
        contorno.puntos.forEach((inicio, segmentIndex) => {
          const fin =
            contorno.puntos[(segmentIndex + 1) % contorno.puntos.length];
          const reemplazado =
            contourIndex === 0 &&
            copyIndex != null &&
            removidos.has(
              claveSegmento(placement.pieceId, copyIndex, segmentIndex),
            );
          if (reemplazado) return;
          paths.push(
            `    <path id="${xmlAttr(placement.pieceId)}-${placementIndex + 1}-${contourIndex + 1}-${segmentIndex + 1}" d="M${numero(inicio.x)} ${numero(inicio.y)} L${numero(fin.x)} ${numero(fin.y)}" />`,
          );
        });
      },
    );
  });
  for (const tramo of result.commonLine?.tramos ?? []) {
    if (tramo.placa !== substrateIndex) continue;
    paths.push(
      `    <path id="${xmlAttr(tramo.id)}" data-common-line="true" d="M${numero(tramo.inicio.x)} ${numero(tramo.inicio.y)} L${numero(tramo.fin.x)} ${numero(tramo.fin.y)}" />`,
    );
  }
  if (paths.length === 0)
    throw new Error("El nesting no contiene geometría vectorial exportable.");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${numero(substrate.widthMm)}mm" height="${numero(substrate.heightMm)}mm" viewBox="0 0 ${numero(substrate.widthMm)} ${numero(substrate.heightMm)}">`,
    `  <title>Placa ${substrateIndex + 1} · nesting Common Line</title>`,
    '  <g id="corte" fill="none" stroke="#000000" stroke-width="0.1" stroke-linejoin="miter" stroke-linecap="square" vector-effect="non-scaling-stroke">',
    ...paths,
    "  </g>",
    operacionesSvg(result, substrateIndex),
    "</svg>",
  ].join("\n");
}

function crearDxfCommonLine(
  result: NestingViewerInput,
  substrateIndex: number,
  substrate: {
    kind: "sheet";
    count: number;
    widthMm: number;
    heightMm: number;
  },
): string {
  const removidos = segmentosReemplazados(result, substrateIndex);
  const entidades: TrazoDxf[] = [];
  result.placements.forEach((placement) => {
    if ((placement.substrateIndex ?? 0) !== substrateIndex) return;
    const meta = placement.meta as
      | {
          contornos?: Contorno[];
          cortesInternos?: Contorno[];
          copiaIndex?: number;
        }
      | undefined;
    const copyIndex = meta?.copiaIndex;
    [...(meta?.contornos ?? []), ...(meta?.cortesInternos ?? [])].forEach(
      (contorno, contourIndex) => {
        contorno.puntos.forEach((inicio, segmentIndex) => {
          const fin =
            contorno.puntos[(segmentIndex + 1) % contorno.puntos.length];
          const reemplazado =
            contourIndex === 0 &&
            copyIndex != null &&
            removidos.has(
              claveSegmento(placement.pieceId, copyIndex, segmentIndex),
            );
          if (!reemplazado)
            entidades.push(dxfLine(inicio, fin, substrate.heightMm, "CORTE"));
        });
      },
    );
  });
  for (const tramo of result.commonLine?.tramos ?? []) {
    if (tramo.placa !== substrateIndex) continue;
    entidades.push(
      dxfLine(tramo.inicio, tramo.fin, substrate.heightMm, "COMMON_LINE"),
    );
  }
  if (entidades.length === 0)
    throw new Error("El nesting no contiene geometría vectorial exportable.");
  return escribirDxf([
    ...entidades,
    ...operacionesDxf(result, substrateIndex, substrate.heightMm),
  ]);
}

function segmentosReemplazados(
  result: NestingViewerInput,
  substrateIndex: number,
) {
  return new Set(
    (result.commonLine?.tramos ?? [])
      .filter((tramo) => tramo.placa === substrateIndex)
      .flatMap((tramo) =>
        tramo.segmentosOrigen.map((segmento) =>
          claveSegmento(
            segmento.piezaId,
            segmento.copia,
            segmento.indiceSegmento,
          ),
        ),
      ),
  );
}

function claveSegmento(piezaId: string, copia: number, indiceSegmento: number) {
  return `${piezaId}:${copia}:${indiceSegmento}`;
}

function dxfLine(
  inicio: Punto,
  fin: Punto,
  plateHeightMm: number,
  layer: string,
): TrazoDxf {
  return (drawing) => {
    activarCapaDxf(drawing, layer);
    drawing.drawLine(
      coordenadaDxf(inicio.x),
      coordenadaDxf(plateHeightMm - inicio.y),
      coordenadaDxf(fin.x),
      coordenadaDxf(plateHeightMm - fin.y),
    );
  };
}

/** Los importadores CAD necesitan tablas, bloques, handles y propietarios,
 * además de ENTITIES. Un DXF mínimo legible por parsers falla en Illustrator. */
function escribirDxf(trazos: TrazoDxf[]): string {
  const drawing = new Drawing();
  drawing.setUnits("Millimeters");
  drawing.header("MEASUREMENT", [[70, 1]]);
  drawing.header("LUNITS", [[70, 2]]);
  drawing.header("LUPREC", [[70, 3]]);
  trazos.forEach((trazar) => trazar(drawing));
  return `${drawing.toDxfString()}\n`;
}

function activarCapaDxf(drawing: Drawing, nombre: string) {
  if (!drawing.layers[nombre]) {
    const colores: Record<string, number> = {
      CORTE: 7,
      CORTE_INTERIOR: 5,
      HENDIDO: 3,
      COMMON_LINE: 4,
    };
    drawing.addLayer(nombre, colores[nombre] ?? 7, "CONTINUOUS");
  }
  drawing.setActiveLayer(nombre);
}

function coordenadaDxf(value: number): number {
  if (!Number.isFinite(value))
    throw new Error(
      "El nesting contiene una coordenada inválida para exportar a DXF.",
    );
  return Math.round(value * 1000) / 1000;
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

function dxfPolyline(points: Punto[], plateHeightMm: number): TrazoDxf {
  return (drawing) => {
    activarCapaDxf(drawing, "CORTE");
    // SVG usa origen superior izquierdo; DXF usa inferior izquierdo.
    drawing.drawPolyline(
      points.map((point) => [
        coordenadaDxf(point.x),
        coordenadaDxf(plateHeightMm - point.y),
      ]),
      true,
    );
  };
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
