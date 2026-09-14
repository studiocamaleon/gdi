import type { Estacion } from "./estaciones";
import {
  resolverEstacionDePaso,
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
      (!filtros.estacionId ||
        (paso.tipoEjecucion !== "tercerizado" &&
          resolverEstacionDePaso(estaciones, paso)?.id ===
            filtros.estacionId)) &&
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
    delayed: items.filter((i) => i.delayed && !i.blocked).length,
    today: items.filter((i) => i.dueDays === 0).length,
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
  { key: "delayed", title: "Con retraso", description: "Entrega vencida" },
  { key: "today", title: "Vencen hoy", description: "Prioridad de despacho" },
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
  if (item.delayed) return "delayed";
  if (item.dueDays === 0) return "today";
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
          (a.dueDays ?? Infinity) - (b.dueDays ?? Infinity) ||
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
