import {
  agruparPatronesNesting,
  nombrePieza,
  type PatronVisible,
} from "./nesting-patrones";
import {
  crearSvgDePlaca,
  crearDxfDePlaca,
  crearDxfFabricacionDePlaca,
} from "./nesting-vectorial-export";
import type { NestingViewerInput } from "./productos-servicios-api";

function patronDe(result: NestingViewerInput, id: string): PatronVisible {
  const patron = agruparPatronesNesting(result).find((p) => p.id === id);
  if (!patron) throw new Error("El patrón seleccionado no existe.");
  return patron;
}

export function nombreArchivoPatron(
  base: string,
  patron: Pick<PatronVisible, "id" | "repeticiones">,
) {
  return `${base}-patron-${patron.id}-x${patron.repeticiones}`;
}

export function crearSvgDePatron(result: NestingViewerInput, id: string) {
  const p = patronDe(result, id);
  return crearSvgDePlaca(result, p.indices[0]).replace(
    /<title>[^<]*<\/title>/,
    `<title>Patrón ${p.id} · ${p.repeticiones} copias</title>`,
  );
}

export function crearDxfDePatron(result: NestingViewerInput, id: string) {
  const p = patronDe(result, id);
  // Conservamos SECTION como inicio del documento para que los importadores
  // reconozcan el formato; las copias son metadatos, nunca trazos de corte.
  return crearDxfDePlaca(result, p.indices[0]).replace(
    "2\nHEADER\n",
    `2\nHEADER\n999\nPatron ${p.id} - ${p.repeticiones} copias\n`,
  );
}

export async function crearDxfFabricacionDePatron(
  result: NestingViewerInput,
  id: string,
) {
  const p = patronDe(result, id);
  return (await crearDxfFabricacionDePlaca(result, p.indices[0])).replace(
    /2\r?\nHEADER\r?\n/,
    `2\nHEADER\n999\nPatron ${p.id} - ${p.repeticiones} copias\n`,
  );
}

export function crearResumenPatrones(result: NestingViewerInput) {
  const patrones = agruparPatronesNesting(result);
  const totales = new Map<string, { nombre: string; cantidad: number }>();
  const detalle = patrones.map((p) => {
    const piezas = Object.entries(p.cantidades).map(([id, n]) => {
      const nombre = nombrePieza(
        p.placements.find((pieza) => pieza.pieceId === id)!,
      );
      const anterior = totales.get(id)?.cantidad ?? 0;
      totales.set(id, { nombre, cantidad: anterior + n * p.repeticiones });
      return `  ${nombre}: ${n} por placa × ${p.repeticiones} = ${n * p.repeticiones}`;
    });
    return [
      `Patrón ${p.id} — ${p.repeticiones} copias — ${p.anchoMm} × ${p.altoMm} mm`,
      ...piezas,
    ].join("\n");
  });
  return [
    "GrafoNest · Plan de fabricación",
    `${patrones.reduce((s, p) => s + p.repeticiones, 0)} placas · ${patrones.length} patrones`,
    "Fabricar las copias indicadas de cada patrón. Los archivos están en milímetros.",
    "",
    ...detalle,
    "",
    "Totales de piezas",
    ...[...totales.values()].map((p) => `${p.nombre}: ${p.cantidad}`),
    `Total: ${[...totales.values()].reduce((s, p) => s + p.cantidad, 0)} piezas`,
    "",
  ].join("\n");
}
