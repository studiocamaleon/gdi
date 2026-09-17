import type { NestingViewerInput } from "./productos-servicios-api";

type Ubicacion = NestingViewerInput["placements"][number];
export type PatronVisible = {
  id: string;
  indices: number[];
  repeticiones: number;
  anchoMm: number;
  altoMm: number;
  placements: Ubicacion[];
  cantidades: Record<string, number>;
};
export const metaPieza = (p: Ubicacion) =>
  p.meta && typeof p.meta === "object"
    ? (p.meta as Record<string, unknown>)
    : {};
export const nombrePieza = (p: Ubicacion) =>
  String(metaPieza(p).label ?? p.pieceId);

// Sólo se omite la identidad de la copia. La geometría, giros, arte,
// operaciones y propietarios siguen formando parte de la equivalencia.
function canonico(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonico);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([k]) =>
            ![
              "copyIndex",
              "copiaIndex",
              "copia",
              "substrateIndex",
              "placa",
            ].includes(k),
        )
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonico(v)]),
    );
  if (typeof value === "number") return Math.round(value * 1e6) / 1e6;
  return value;
}

/** Agrupa placas existentes sin recolocar piezas ni confundir patrones que
 * tienen las mismas cantidades pero posiciones o arte diferentes. */
export function agruparPatronesNesting(
  result: NestingViewerInput,
): PatronVisible[] {
  if (
    !result.substrates.length ||
    result.substrates.some((s) => s.kind !== "sheet") ||
    result.talonarioGrouping
  )
    return [];
  const patrones = new Map<string, PatronVisible>();
  result.substrates.forEach((s, index) => {
    if (s.kind !== "sheet") return;
    const placements = result.placements.filter(
      (p) => (p.substrateIndex ?? 0) === index,
    );
    if (!placements.length) return;
    const firma = JSON.stringify([
      s.widthMm,
      s.heightMm,
      result.visualConfig,
      result.commonLine?.aplicado ? canonico({
        anchoCorteMm: result.commonLine.anchoCorteMm,
        tramos: result.commonLine.tramos.filter(t => t.placa === index)
          .map(({ id: _id, ...tramo }) => canonico(tramo))
          .map(t => JSON.stringify(t)).sort(),
      }) : null,
      placements.map((p) => JSON.stringify(canonico(p))).sort(),
    ]);
    const encontrado = patrones.get(firma);
    if (encontrado) {
      encontrado.indices.push(index);
      encontrado.repeticiones += s.count;
      return;
    }
    const cantidades: Record<string, number> = {};
    placements.forEach((p) => {
      cantidades[p.pieceId] = (cantidades[p.pieceId] ?? 0) + 1;
    });
    patrones.set(firma, {
      id: "",
      indices: [index],
      repeticiones: s.count,
      anchoMm: s.widthMm,
      altoMm: s.heightMm,
      placements,
      cantidades,
    });
  });
  return [...patrones.values()]
    .sort((a, b) => b.repeticiones - a.repeticiones)
    .map((p, i) => ({
      ...p,
      id: i < 26 ? String.fromCharCode(65 + i) : String(i + 1),
    }));
}

export function contornosPatron(
  p: Ubicacion,
): Array<{ puntos: Array<{ x: number; y: number }> }> {
  const value = metaPieza(p).contornos;
  if (!Array.isArray(value)) return [];
  return value.filter(
    (c) =>
      c &&
      Array.isArray(c.puntos) &&
      c.puntos.length >= 3 &&
      c.puntos.every(
        (v: { x: number; y: number }) =>
          Number.isFinite(v.x) && Number.isFinite(v.y),
      ),
  );
}
