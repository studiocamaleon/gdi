import type { Estacion } from "./estaciones";
import type { ItemView } from "./produccion-item-view";
import type { PasoProgramado } from "./flujo-produccion";
import { estacionDelPasoVisible, operadoresDelTrabajo, type responsablesDeEspera } from "./tablero-lista";
import { cumplimientoPaso, finActualPaso, finPrevistoPaso } from "./tiempos-paso";
import { calcularProgreso } from "./progreso-produccion";

export type CampoLista = "trabajo" | "cantidad" | "paso" | "personal" | "estado" | "previsto" | "real" | "cumplimiento" | "avance";
export type RevisionCeldas = Record<CampoLista, string>;
export type CambiosCeldas = ReadonlyMap<string, ReadonlySet<CampoLista>>;

/** Compara el contenido visible de cada celda, no el objeto completo ni el grupo. */
export function revisionCeldasEnVivo(
  item: ItemView,
  estaciones: Estacion[],
  plan: Pick<PasoProgramado, "fin" | "parcial"> | undefined,
  esperas: ReturnType<typeof responsablesDeEspera>,
  accionManual?: "asignarme" | "devolver" | null,
  puedeReasignar = false,
): RevisionCeldas {
  const paso = item.visibleStep?.paso;
  const lote = item.data.loteEntrega;
  const previsto = finPrevistoPaso(paso);
  const actual = finActualPaso(paso, plan?.fin);
  const cumplimiento = cumplimientoPaso(previsto, actual);
  const terminado = paso?.estado === "hecho";
  const operadores = operadoresDelTrabajo(item);
  const minuto = (fecha: Date | null) => fecha ? Math.floor(fecha.getTime() / 60_000) : null;
  return {
    trabajo: JSON.stringify([item.code, item.customer, item.product, lote
      ? [lote.nombre, lote.esProductoDelLote ? "Producto" : lote.productoNombre]
      : item.data.componenteDe?.nombre]),
    cantidad: JSON.stringify(item.qtyLabel),
    paso: JSON.stringify([
      paso?.nombre ?? (item.finished ? "Completado" : item.sinRuta ? "Sin ruta" : "En espera"),
      !item.finished && estacionDelPasoVisible(item, estaciones),
      item.currentSteps.length > 1 ? item.currentSteps.length : 0, item.blockedReason,
    ]),
    personal: JSON.stringify([
      operadores, !operadores.length && item.finished,
      paso?.asignacionPersonal?.personas.length ? paso.asignacionPersonal.origen : null,
      paso?.asignacionPersonal?.conflicto, paso?.tramoAbierto?.usuarioNombre, accionManual, puedeReasignar,
    ]),
    estado: JSON.stringify([
      item.state, item.state === "ready" && cumplimiento.tipo === "demorado",
      esperas.map(({ texto, tercerizado }) => [texto, tercerizado]),
    ]),
    previsto: JSON.stringify(minuto(previsto)),
    real: JSON.stringify([minuto(actual), terminado]),
    cumplimiento: JSON.stringify([cumplimiento, cumplimiento.minutos != null && terminado]),
    avance: JSON.stringify([item.progressPct, calcularProgreso(item.data.pasos).porcentaje]),
  };
}

/** Altas, bajas y cambios de sección no hacen parpadear las demás celdas. */
export function celdasQueCambian(
  antes: ReadonlyMap<string, RevisionCeldas>,
  despues: ReadonlyMap<string, RevisionCeldas>,
): CambiosCeldas {
  const cambios = new Map<string, ReadonlySet<CampoLista>>();
  for (const [id, anterior] of antes) {
    const siguiente = despues.get(id);
    if (!siguiente) continue;
    const campos = new Set((Object.keys(anterior) as CampoLista[]).filter(campo => anterior[campo] !== siguiente[campo]));
    if (campos.size) cambios.set(id, campos);
  }
  return cambios;
}
