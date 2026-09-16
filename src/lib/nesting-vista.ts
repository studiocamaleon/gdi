import type { NestingViewerInput } from "./productos-servicios-api";
import { agruparPatronesNesting, nombrePieza } from "./nesting-patrones";

/** Navegación basada en el resultado, compartida por todas las entradas al visor. */
export function crearNavegacionNesting(result: NestingViewerInput) {
  const patrones = result.outputsCanonicos?.plan_imposicion
    ? []
    : agruparPatronesNesting(result);
  let siguiente = 1;
  const sustratos = result.substrates.map((s, index) => {
    const cantidad = s.kind === "sheet" ? s.count : 1;
    const desde = siguiente;
    siguiente += cantidad;
    const unidad =
      s.kind === "roll"
        ? "Rollo"
        : result.algorithm.startsWith("grid-2d")
          ? "Pliego"
          : "Placa";
    const rango = cantidad > 1 ? `${desde}–${siguiente - 1}` : String(desde);
    return {
      index,
      cantidad,
      desde,
      hasta: siguiente - 1,
      label: `${unidad}${cantidad > 1 ? "s" : ""} ${rango}`,
      layout: patrones.find((p) => p.indices.includes(index))?.id,
    };
  });
  return {
    patrones,
    sustratos,
    totalSustratos: siguiente - 1,
    // Una vista de conjunto aporta cuando hay varias superficies. Las hojas
    // con imposición por páginas mantienen su explicación en el detalle.
    vistaInicial:
      patrones.length > 0 &&
      siguiente > 2 &&
      !result.outputsCanonicos?.plan_imposicion
        ? ("layouts" as const)
        : ("detalle" as const),
  };
}

export function balancePiezasNesting(result: NestingViewerInput) {
  const filas = new Map<
    string,
    { id: string; nombre: string; colocadas: number; solicitadas?: number }
  >();
  for (const p of result.placements) {
    const s = result.substrates[p.substrateIndex ?? 0];
    const multiplicador = s?.kind === "sheet" ? s.count : 1;
    const fila = filas.get(p.pieceId) ?? {
      id: p.pieceId,
      nombre: nombrePieza(p),
      colocadas: 0,
    };
    fila.colocadas += multiplicador;
    filas.set(p.pieceId, fila);
  }
  for (const d of result.solucionNesting?.problema.demandas ?? []) {
    const fila = filas.get(d.id) ?? { id: d.id, nombre: d.id, colocadas: 0 };
    filas.set(d.id, { ...fila, solicitadas: d.cantidad });
  }
  return [...filas.values()];
}
