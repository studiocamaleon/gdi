import {
  agruparPatronesNesting,
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
