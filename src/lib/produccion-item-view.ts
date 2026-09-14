import {
  codigoVisibleItem,
  nombreTrabajoTablero,
  textoDependenciaTablero,
  pasosActivos,
  resolverEstacionDePaso,
  familiaIcono,
  itemBloqueado,
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
  currentSteps: StepView[];
  steps: StepView[];
};

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
): ItemView {
  const activos = pasosActivos(item);
  const actual = activos[0];
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
  const blocked = itemBloqueado(item);
  const bloqueadoPaso = item.pasos.find((paso) => paso.estado === "bloqueado");
  const proximo = actual ?? item.pasos.find((paso) => paso.estado !== "hecho");
  const dependencias = proximo?.dependenciasPendientes ?? [];
  const espera = dependencias.length
    ? `Espera: ${dependencias.slice(0, 2).map(textoDependenciaTablero).join("; ")}${dependencias.length > 2 ? ` y ${dependencias.length - 2} más` : ""}`
    : "Esperando componentes o pasos anteriores";
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
    blockedReason:
      bloqueadoPaso?.motivoBloqueo ?? (blocked && !actual ? espera : null),
    dependencias,
    started: itemIniciado(item),
    finished: itemTerminado(item),
    sinRuta: item.sinRuta,
    progressPct: progresoItem(item),
    statusLine:
      blocked && !actual && dependencias.length ? espera : lineaEstado(item),
    station: actual
      ? actual.tipoEjecucion === "tercerizado"
        ? "Proveedor tercerizado"
        : (estacionActual?.nombre ?? "Sin estación")
      : "—",
    stationIcon: estacionActual?.icono ?? null,
    currentStep,
    currentSteps,
    steps,
  };
}
