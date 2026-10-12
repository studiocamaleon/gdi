import type { ResultadoCeldaSimulacion } from "../../apps/api/src/centro-copiado/tarifarios/simulacion-tarifario.types";
import { DecimalComercial as D } from "../../apps/api/src/centro-copiado/comercial/validaciones";

/** A precio único, comparar la cobertura más exigente en cada cantidad.
 * No mezclar el mínimo de borrador con el máximo de alta cobertura.
 */
export function resumirCostosRango(
  r: ResultadoCeldaSimulacion,
  coberturas: string[],
) {
  const rango = r.rangoCostos;
  if (!rango) return { motivo: "Volvé a calcular para comparar el rango." };
  if (rango.motivo) return { motivo: rango.motivo };
  if (
    rango.puntos.length !== 2 ||
    !["INICIO", "FIN"].every((extremo) =>
      rango.puntos.some((p) => p.extremo === extremo),
    )
  )
    return { motivo: "Falta un extremo del rango por calcular." };
  const extremos = [];
  for (const punto of rango.puntos) {
    if (
      punto.escenarios.length !== coberturas.length ||
      coberturas.some(
        (c) =>
          punto.escenarios.filter(
            (e) => e.cobertura === c && e.estado === "CALCULADO",
          ).length !== 1,
      )
    )
      return { motivo: "Hay un extremo o cobertura sin costo verificable." };
    const costos = punto.escenarios.map((e) =>
      e.estado === "CALCULADO" ? new D(e.costoUnitario) : new D(NaN),
    );
    if (costos.some((c) => !c.isFinite() || c.lt(0)))
      return { motivo: "El rango contiene un costo inválido." };
    extremos.push({
      cantidad: punto.cantidadObjetivo,
      costo: D.max(...costos),
    });
  }
  const minimo = D.min(...extremos.map((p) => p.costo));
  const maximo = D.max(...extremos.map((p) => p.costo));
  return {
    minimo: minimo.toFixed(),
    maximo: maximo.toFixed(),
    promedio: minimo.plus(maximo).div(2).toFixed(),
    desde: extremos[0].cantidad,
    hasta: extremos[1].cantidad,
    abierto: rango.abierto,
    motivo: null,
  };
}
