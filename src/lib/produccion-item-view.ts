import {
  codigoVisibleItem,
  nombreTrabajoTablero,
  textoDependenciaTablero,
  pasoActivo,
  pasosActivos,
  resolverEstacionDePaso,
  familiaIcono,
  prioridadDerivada,
  etiquetaEntrega,
  etiquetaRestante,
  diasHastaEntrega,
  itemConRetraso,
  itemIniciado,
  itemTerminado,
  progresoItem,
  lineaEstado,
  type TableroItemData,
  type TableroPasoData,
  type TableroPrioridad,
} from "@/lib/tablero-produccion";
import type { Estacion } from "@/lib/estaciones";
import { ZONA_DEFAULT } from "@/lib/zona";
export type StepStatus = "done" | "current" | "paused" | "pending" | "blocked";
export type EstadoTrabajo =
  | "done"
  | "blocked"
  | "active"
  | "paused"
  | "ready"
  | "waiting";
export const ESTADO_TRABAJO_LABELS: Record<EstadoTrabajo, string> = {
  done: "Terminado",
  blocked: "Bloqueado",
  active: "En curso",
  paused: "Pausado",
  ready: "Listo para iniciar",
  waiting: "En espera",
};

export type StepView = {
  paso: TableroPasoData;
  status: StepStatus;
  /** Paso ACTIVO (frontera de la secuencia): el diseño lo destaca con anillo. */
  esActivo: boolean;
  iconKey: string;
  /** Subtítulo técnico: la estación (centro de costo) del paso. */
  tec: string;
};

export type ItemView = {
  data: TableroItemData;
  id: string;
  code: string;
  otCode: string;
  customer: string;
  vendedor: string;
  product: string;
  spec: string;
  /**
   * Medida que hay que CORTAR cuando un paso de modificación (bolsillo,
   * refuerzo) agrandó la pieza. Va aparte y etiquetada: en el resumen suelto
   * quedarían dos medidas sin rótulo y el operario no sabría cuál cortar.
   */
  corteLabel: string | null;
  qtyLabel: string;
  priority: TableroPrioridad;
  dueLabel: string;
  dueIn: string;
  dueDays: number | null;
  delayed: boolean;
  blocked: boolean;
  blockedReason: string | null;
  waitingReason: string | null;
  waitingReasons: string[];
  state: EstadoTrabajo;
  dependencias: NonNullable<TableroPasoData["dependenciasPendientes"]>;
  started: boolean;
  finished: boolean;
  sinRuta: boolean;
  progressPct: number;
  statusLine: string;
  /** Estación REAL del paso activo (resuelta por familia+máquina), o "—". */
  station: string;
  /** Icono de esa estación (clave del set del tablero). */
  stationIcon: string | null;
  currentStep: StepView | undefined;
  visibleStep: StepView | undefined;
  currentSteps: StepView[];
  steps: StepView[];
};

/** Requisitos de lectura: no altera el estado persistido ni autoriza acciones. */
function motivosEspera(
  item: TableroItemData,
  paso: TableroPasoData,
  estaciones: Estacion[],
): string[] {
  const motivos: string[] = [];
  if (!pasoActivo(item, paso)) {
    const dependencias = paso.dependenciasPendientes ?? [];
    motivos.push(
      dependencias.length
        ? `Espera: ${dependencias.map(textoDependenciaTablero).join("; ")}`
        : "Esperando componentes o pasos anteriores",
    );
  }
  for (const gate of paso.gatesOperativos ?? []) {
    if (gate.estado !== "CUMPLIDO")
      motivos.push(
        gate.detalle ||
          (gate.tipo === "MATERIAL"
            ? "Falta material disponible/asignado"
            : "Falta verificar calidad"),
      );
  }
  for (const nombre of paso.aprobacionesPendientes ?? [])
    motivos.push(`Falta aprobación: ${nombre}`);
  if (
    paso.tipoEjecucion !== "tercerizado" &&
    !resolverEstacionDePaso(estaciones, paso)
  ) {
    motivos.push("Falta una estación activa o una máquina habilitada");
  }
  return motivos;
}

function stepStatus(paso: TableroPasoData): StepStatus {
  switch (paso.estado) {
    case "hecho":
      return "done";
    case "en_curso":
      return "current";
    case "pausado":
      return "paused";
    case "bloqueado":
      return "blocked";
    default:
      return "pending";
  }
}

export function buildItemView(
  item: TableroItemData,
  estaciones: Estacion[],
  zona = ZONA_DEFAULT,
  ahora = new Date(),
  incluyePaso?: (paso: TableroPasoData) => boolean,
): ItemView {
  const activos = pasosActivos(item);
  // El filtro elige qué paso se representa, sin recortar la ruta ni perder
  // dependencias. El detalle y los permisos siguen usando el item completo.
  const candidatos = incluyePaso ? item.pasos.filter(incluyePaso) : item.pasos;
  const activosVisibles = incluyePaso ? activos.filter(incluyePaso) : activos;
  // Conserva el bloqueo explícito como alerta. En las demás ramas prioriza
  // ejecución y trabajo listo antes de una rama que aún espera requisitos.
  const bloqueadoPaso = candidatos.find((paso) => paso.estado === "bloqueado");
  const actual =
    bloqueadoPaso ??
    activosVisibles.find((paso) => paso.estado === "en_curso") ??
    activosVisibles.find(
      (paso) =>
        paso.estado === "pendiente" &&
        motivosEspera(item, paso, estaciones).length === 0,
    ) ??
    activosVisibles.find((paso) => paso.estado === "pausado") ??
    activosVisibles[0];
  const estacionActual = actual
    ? resolverEstacionDePaso(estaciones, actual)
    : null;
  const steps = item.pasos.map<StepView>((paso) => ({
    paso,
    status: stepStatus(paso),
    esActivo: activos.some((activo) => activo.id === paso.id),
    iconKey: familiaIcono(paso.familiaCodigo, paso.plantillaCodigo),
    tec: paso.centroCostoNombre ?? "Paso manual",
  }));
  const currentStep = actual
    ? steps.find((s) => s.paso.id === actual.id)
    : undefined;
  const currentSteps = steps.filter((step) => step.esActivo);
  const blocked = !!bloqueadoPaso;
  const proximo = actual ?? candidatos.find((paso) => paso.estado !== "hecho");
  const visibleStep = steps.find((step) => step.paso.id === proximo?.id);
  const dependencias = proximo?.dependenciasPendientes ?? [];
  const motivos = proximo
    ? motivosEspera(item, proximo, estaciones)
    : ["Sin ruta de producción cargada"];
  const tercerizadoPedido =
    proximo?.tipoEjecucion === "tercerizado" &&
    ["pedido", "recibido", "entregado"].includes(proximo.estadoCompra ?? "");
  const state: EstadoTrabajo = itemTerminado(item)
    ? "done"
    : blocked
      ? "blocked"
      : proximo?.estado === "en_curso"
        ? "active"
        : proximo?.estado === "pausado"
          ? "paused"
          : motivos.length
            ? "waiting"
            : tercerizadoPedido
              ? "active"
              : "ready";
  const waitingReason = state === "waiting" ? motivos.join(" · ") : null;
  // La Lista separa cada dependencia sin partir nombres o motivos libres por
  // signos de puntuación; las demás vistas conservan el resumen existente.
  const waitingReasons =
    state !== "waiting"
      ? []
      : proximo && !pasoActivo(item, proximo) && dependencias.length
        ? [
            ...dependencias.map((d) => `Espera: ${textoDependenciaTablero(d)}`),
            ...motivos.slice(1),
          ]
        : motivos;
  // El resumen une valores SIN etiqueta, así que la medida de corte no puede
  // entrar acá: quedarían dos medidas sueltas y ninguna diría cuál cortar.
  const esSpecCorte = (etiqueta: string) =>
    etiqueta.trim().toLowerCase() === "medida de corte";
  const spec = item.specs
    .filter((entry) => !esSpecCorte(entry.etiqueta))
    .slice(0, 3)
    .map((entry) => entry.valor)
    .filter(Boolean)
    .join(" · ");
  const corteLabel =
    item.specs.find((entry) => esSpecCorte(entry.etiqueta))?.valor ?? null;

  return {
    data: item,
    id: item.id,
    code: codigoVisibleItem(item.ordenNumero, item.itemIndice),
    otCode: item.ordenNumero,
    customer: item.clienteNombre,
    vendedor: item.vendedorNombre,
    product: nombreTrabajoTablero(item),
    spec: spec || (item.loteEntrega ? "" : item.codigo),
    corteLabel,
    qtyLabel: `${item.cantidad.toLocaleString("es-AR")} ${item.cantidadUnidad}`,
    priority: prioridadDerivada(item.fechaEntrega, ahora, zona),
    dueLabel: etiquetaEntrega(item.fechaEntrega, ahora, zona),
    dueIn: etiquetaRestante(item.fechaEntrega, ahora, zona),
    dueDays: diasHastaEntrega(item.fechaEntrega, ahora, zona),
    delayed: itemConRetraso(item, ahora, zona),
    blocked,
    blockedReason: blocked
      ? bloqueadoPaso?.motivoBloqueo ||
        "Bloqueo registrado; requiere resolución"
      : null,
    waitingReason,
    waitingReasons,
    state,
    dependencias,
    started: itemIniciado(item),
    finished: itemTerminado(item),
    sinRuta: item.sinRuta,
    progressPct: progresoItem(item),
    statusLine:
      waitingReason ??
      (blocked
        ? `Bloqueado en ${proximo?.nombre}`
        : state === "ready"
          ? `Listo para iniciar · ${proximo?.nombre}`
          : lineaEstado(item, proximo)),
    station: actual
      ? actual.tipoEjecucion === "tercerizado"
        ? "Proveedor tercerizado"
        : (estacionActual?.nombre ?? "Sin estación")
      : "—",
    stationIcon: estacionActual?.icono ?? null,
    currentStep,
    visibleStep,
    currentSteps,
    steps,
  };
}
