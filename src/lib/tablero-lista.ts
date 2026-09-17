import type { Estacion } from "./estaciones";
import {
  resolverEstacionDePaso,
  pasoActivo,
  SIN_ESTACION_KEY,
  TERCERIZADOS_KEY,
  textoDependenciaTablero,
  type TableroPasoData,
} from "./tablero-produccion";
import { buildItemView, type ItemView } from "./produccion-item-view";

export type FiltrosTrabajo = {
  query: string;
  asignadasAMi: boolean;
  estacionId: string;
  empleadoId: string;
};

export function opcionesEstacionesTablero(estaciones: Estacion[], seleccionada: string) {
  const opciones = estaciones
    .filter((e) => e.activo || e.id === seleccionada)
    .map((e) => ({ id: e.id, nombre: `${e.nombre}${e.activo ? "" : " · Inactiva"}` }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  opciones.push(
    { id: SIN_ESTACION_KEY, nombre: "Sin estación" },
    { id: TERCERIZADOS_KEY, nombre: "Proveedor tercerizado" },
  );
  if (seleccionada && !opciones.some((e) => e.id === seleccionada))
    opciones.push({ id: seleccionada, nombre: "Estación no disponible" });
  return opciones;
}

function perteneceAEstacion(paso: TableroPasoData, estacionId: string, estaciones: Estacion[]) {
  if (!estacionId) return true;
  const key = paso.tipoEjecucion === "tercerizado"
    ? TERCERIZADOS_KEY
    : resolverEstacionDePaso(estaciones, paso)?.id ?? SIN_ESTACION_KEY;
  return key === estacionId;
}

/** Una fila por trabajo, centrada en el próximo paso del ámbito elegido. */
export function filtrarTrabajos(
  items: ItemView[],
  estaciones: Estacion[],
  filtros: FiltrosTrabajo,
  zona: string,
  ahora: Date,
): ItemView[] {
  const query = filtros.query.trim().toLocaleLowerCase("es");
  const acotado = !!(
    filtros.estacionId ||
    filtros.empleadoId ||
    filtros.asignadasAMi
  );
  return items.flatMap((item) => {
    const texto =
      `${item.code} ${item.otCode} ${item.customer} ${item.product} ${item.spec} ${item.data.loteEntrega?.nombre ?? ""} ${item.data.loteEntrega?.productoNombre ?? ""}`.toLocaleLowerCase(
        "es",
      );
    if (query && !texto.includes(query)) return [];
    if (!acotado) return [item];
    const incluyePaso = (paso: ItemView["data"]["pasos"][number]) =>
      paso.estado !== "hecho" &&
      perteneceAEstacion(paso, filtros.estacionId, estaciones) &&
      (!filtros.empleadoId ||
        !!paso.asignacionPersonal?.personas.some(
          (p) => p.empleadoId === filtros.empleadoId,
        )) &&
      (!filtros.asignadasAMi ||
        !!(
          paso.asignacionPersonal?.esMia ||
          paso.mesaEsMia ||
          paso.tramoAbierto?.esMio
        ));
    if (!item.data.pasos.some(incluyePaso)) return [];
    return [buildItemView(item.data, estaciones, zona, ahora, incluyePaso)];
  });
}

export function metricasTrabajos(items: ItemView[]) {
  return {
    all: items.length,
    ready: items.filter((i) => i.state === "ready").length,
    inProgress: items.filter((i) => i.state === "active").length,
    waiting: items.filter((i) => i.state === "waiting").length,
    paused: items.filter((i) => i.state === "paused").length,
    blocked: items.filter((i) => i.blocked).length,
    delayed: items.filter((i) => i.stepDelayed && !i.blocked).length,
    today: items.filter((i) => i.stepDueDays === 0).length,
  };
}

export const GRUPOS_TABLERO = [
  {
    key: "blocked",
    title: "Bloqueados",
    description: "Impedimentos que requieren resolución",
  },
  {
    key: "waiting",
    title: "En espera",
    description: "Dependencias o requisitos pendientes",
  },
  {
    key: "delayed",
    title: "Con retraso",
    description: "Fin previsto del paso vencido",
  },
  {
    key: "today",
    title: "Vencen hoy",
    description: "Pasos con fin previsto para hoy",
  },
  { key: "active", title: "En curso", description: "Trabajos en ejecución" },
  {
    key: "paused",
    title: "Pausados",
    description: "Ejecuciones interrumpidas temporalmente",
  },
  {
    key: "not-started",
    title: "Listos para iniciar",
    description: "El próximo paso ya puede comenzar",
  },
] as const;
export type GrupoTableroKey = (typeof GRUPOS_TABLERO)[number]["key"];

export function grupoDelTrabajo(item: ItemView): GrupoTableroKey | null {
  if (item.finished) return null;
  if (item.state === "blocked" || item.state === "waiting") return item.state;
  if (item.stepDelayed) return "delayed";
  if (item.stepDueDays === 0) return "today";
  if (item.state === "paused") return "paused";
  return item.state === "active" ? "active" : "not-started";
}
export function agruparTrabajos(items: ItemView[]) {
  const porGrupo = new Map<GrupoTableroKey, ItemView[]>(
    GRUPOS_TABLERO.map((g) => [g.key, []]),
  );
  for (const item of items) {
    const grupo = grupoDelTrabajo(item);
    if (grupo) porGrupo.get(grupo)!.push(item);
  }
  return GRUPOS_TABLERO.map((grupo) => ({
    ...grupo,
    items: porGrupo
      .get(grupo.key)!
      .sort(
        (a, b) =>
          (a.stepPlannedEnd ? Date.parse(a.stepPlannedEnd) : Infinity) -
            (b.stepPlannedEnd ? Date.parse(b.stepPlannedEnd) : Infinity) ||
          a.code.localeCompare(b.code),
      ),
  }));
}

/** La asignación corresponde al paso visible; la ejecución se muestra aparte. */
export function operadoresDelTrabajo(item: ItemView): string[] {
  const paso = item.visibleStep?.paso;
  if (!paso) return [];
  const asignados =
    paso.asignacionPersonal?.personas.map((p) => p.nombre) ?? [];
  if (asignados.length) return asignados;
  const nombre = paso.tramoAbierto?.usuarioNombre ?? paso.mesaUsuarioNombre;
  return nombre ? [nombre] : [];
}

/** Personal del predecesor pendiente, no del paso que está esperando. */
export function responsablesDeEspera(
  item: ItemView,
  pasosPorId: ReadonlyMap<string, TableroPasoData>,
) {
  const paso = item.visibleStep?.paso;
  if (
    item.state !== "waiting" ||
    !paso ||
    (paso.nodoClave && paso.predecesoresSatisfechos === true)
  )
    return [];

  const dependencias = paso.dependenciasPendientes ?? [];
  const ids = dependencias.length
    ? dependencias.map((dependencia) => dependencia.pasoId)
    : paso.nodoClave
      ? (paso.predecesorPasoIds ?? [])
      : item.data.pasos
          .filter(
            (previo) =>
              previo.indice < paso.indice && previo.estado !== "hecho",
          )
          .sort((a, b) => b.indice - a.indice)
          .slice(0, 1)
          .map((previo) => previo.id);

  return [...new Set(ids)].flatMap((id) => {
    const previo = pasosPorId.get(id);
    if (previo?.estado === "hecho") return [];
    const dependencia = dependencias.find((d) => d.pasoId === id);
    const detalle = dependencia
      ? textoDependenciaTablero(dependencia)
      : (previo?.nombre ?? "Paso previo");
    const personal =
      previo?.asignacionPersonal?.personas.map((p) => p.nombre) ?? [];
    const respaldo =
      previo?.tramoAbierto?.usuarioNombre ?? previo?.mesaUsuarioNombre;
    const nombres = personal.length ? personal : respaldo ? [respaldo] : [];
    return [
      {
        pasoId: id,
        detalle,
        texto: !previo
          ? "Asignación no disponible"
          : previo.tipoEjecucion === "tercerizado"
            ? `Proveedor: ${previo.proveedorNombre ?? "por definir"}`
            : nombres.length
              ? nombres.join(" · ")
              : "Sin asignar",
        tercerizado: previo?.tipoEjecucion === "tercerizado",
      },
    ];
  });
}

export function trabajoAsignadoAMi(item: ItemView): boolean {
  const paso = item.visibleStep?.paso;
  return (
    !!paso &&
    !!(
      paso.asignacionPersonal?.esMia ||
      paso.mesaEsMia ||
      paso.tramoAbierto?.esMio
    )
  );
}

/** Traslada la asignación voluntaria a Lista; el servidor revalida al guardar. */
export function accionAsignacionManual(
  item: ItemView,
  estaciones: Estacion[],
  canManage: boolean,
  estacionIdsEjecutables: string[] | null,
): "asignarme" | "devolver" | null {
  const paso = item.visibleStep?.paso;
  if (!canManage || item.finished || !paso || paso.estado === "hecho" || paso.tipoEjecucion === "tercerizado") return null;
  // Una asignación tomada a mano sigue pudiendo devolverse después de proyectarla.
  if (paso.mesaEsMia) return "devolver";
  if (paso.mesaUsuarioNombre || paso.asignacionPersonal?.personas.length || !pasoActivo(item.data, paso)) return null;
  const estacion = resolverEstacionDePaso(estaciones, paso);
  return estacionIdsEjecutables === null || (estacion && estacionIdsEjecutables.includes(estacion.id))
    ? "asignarme" : null;
}

/** La API vuelve a comprobar permisos, dotación y ejecución al revisar y guardar. */
export function puedeReasignarPersonal(item: ItemView, estaciones: Estacion[], supervisor: boolean) {
  const paso = item.visibleStep?.paso;
  if (!supervisor || item.finished || !paso || !["pendiente", "bloqueado"].includes(paso.estado)
    || paso.iniciadoEl || paso.tramosEjecucion?.length || paso.tipoEjecucion !== "interno") return false;
  const estacion = resolverEstacionDePaso(estaciones, paso);
  return !!estacion?.activo && !!estacion.planificacionPorEmpleados;
}

/** La estación pertenece al paso mostrado, incluso si espera una dependencia. */
export function estacionDelPasoVisible(
  item: ItemView,
  estaciones: Estacion[],
): string {
  const step = item.visibleStep;
  if (!step) return item.finished ? "—" : "Sin estación";
  if (step.paso.tipoEjecucion === "tercerizado") return "Proveedor tercerizado";
  return (
    resolverEstacionDePaso(estaciones, step.paso)?.nombre ?? "Sin estación"
  );
}
