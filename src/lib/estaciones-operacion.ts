import type { ItemView, StepView } from "./produccion-item-view";
import {
  compararTareasEstacion,
  resolverEstacionDePaso,
  pasoActivo,
  SIN_ESTACION_KEY,
  TERCERIZADOS_KEY,
} from "./tablero-produccion";
import {
  etiquetaCalendario,
  type Estacion,
  type CalendarioEstacion,
} from "./estaciones";
export type StationInfo = {
  key: string;
  nm: string;
  icono: string | null;
  /** Puestos de trabajo configurados; null para el bucket "Sin estación". */
  capacidad: number | null;
  /** Calendario semanal (proyecta la cola en días); null = sin horario. */
  calendario: CalendarioEstacion | null;
  /** Label derivado del calendario ("L–V 8:00–18:00"); null = sin horario. */
  horario: string | null;
  /** Etapa productiva fija elegida en la estación (null = sin estación). */
  etapa: string | null;
  sinEstacion: boolean;
  /** Bucket sintético de tercerizados (compras a proveedor, no trabajo de piso). */
  tercerizada: boolean;
};

export type StationTask = {
  item: ItemView;
  step: StepView;
  isCurrent: boolean;
  isBlocked: boolean;
  isPending: boolean;
  overdue: boolean;
  urgent: boolean;
};

/**
 * Paso FUTURO de un item vivo: pendiente, no activo todavía. Va a caer en
 * su estación cuando avance la secuencia — es la "carga en camino" (D10).
 */
export type IncomingTask = {
  item: ItemView;
  step: StepView;
};

function ordenarTareas(tasks: StationTask[]): StationTask[] {
  return tasks.sort(compararTareasEstacion);
}

/**
 * Modelo de la vista: las estaciones ACTIVAS configuradas + el bucket "Sin
 * estación", con sus tareas activas (la COLA: el paso listo de cada item)
 * y sus pasos EN CAMINO (futuros pendientes de items vivos, que caerán acá
 * cuando avance la secuencia — D10, se muestran aparte, nunca sumados a la
 * cola). El paso interno llega a su estación por las REGLAS de captura (ver
 * resolverEstacionDePaso); los TERCERIZADOS van a un bucket sintético propio
 * ("Proveedor tercerizado"), no a la estación que les tocaría por familia.
 */
export function buildStationsModel(items: ItemView[], estaciones: Estacion[]) {
  const tareas = new Map<string, StationTask[]>();
  const entrantes = new Map<string, IncomingTask[]>();

  // Un paso tercerizado es una compra al proveedor, no trabajo de piso: se
  // agrupa en el bucket sintético "Proveedor tercerizado", no en la estación
  // que le tocaría por familia. Los internos sí ruteando por reglas.
  const estacionDe = (step: StepView) =>
    step.paso.tipoEjecucion === "tercerizado"
      ? TERCERIZADOS_KEY
      : (resolverEstacionDePaso(estaciones, step.paso)?.id ?? SIN_ESTACION_KEY);

  for (const item of items) {
    for (const step of item.steps) {
      if (pasoActivo(item.data, step.paso)) {
        const key = estacionDe(step);
        const lista = tareas.get(key) ?? [];
        lista.push({
          item,
          step,
          isCurrent: step.status === "current",
          isBlocked: step.status === "blocked",
          isPending: step.status === "pending",
          overdue: item.delayed && step.status !== "blocked",
          urgent:
            item.priority === "urgent" ||
            (item.delayed && step.status !== "blocked") ||
            step.status === "blocked",
        });
        tareas.set(key, lista);
        continue;
      }
      // Futuro = pendiente no activo (los hechos ya no son carga).
      if (step.paso.estado !== "pendiente") continue;
      const key = estacionDe(step);
      const lista = entrantes.get(key) ?? [];
      lista.push({ item, step });
      entrantes.set(key, lista);
    }
  }
  for (const lista of tareas.values()) ordenarTareas(lista);

  const stations: StationInfo[] = estaciones
    .filter((estacion) => estacion.activo)
    .map((estacion) => ({
      key: estacion.id,
      nm: estacion.nombre,
      icono: estacion.icono,
      capacidad: estacion.planificacionPorEmpleados ? null : estacion.capacidadConcurrente,
      calendario: estacion.calendario,
      horario: etiquetaCalendario(estacion.calendario),
      etapa: estacion.etapa,
      sinEstacion: false,
      tercerizada: false,
    }));
  if (tareas.has(TERCERIZADOS_KEY) || entrantes.has(TERCERIZADOS_KEY)) {
    stations.push({
      key: TERCERIZADOS_KEY,
      nm: "Proveedor tercerizado",
      icono: null,
      capacidad: null,
      calendario: null,
      horario: null,
      etapa: null,
      sinEstacion: false,
      tercerizada: true,
    });
  }
  if (tareas.has(SIN_ESTACION_KEY) || entrantes.has(SIN_ESTACION_KEY)) {
    stations.push({
      key: SIN_ESTACION_KEY,
      nm: "Sin estación",
      icono: null,
      capacidad: null,
      calendario: null,
      horario: null,
      etapa: null,
      sinEstacion: true,
      tercerizada: false,
    });
  }

  return { stations, tareas, entrantes };
}

export function taskId(task: StationTask) {
  return task.step.paso.id;
}

/**
 * Duración estimada del paso para la cola: la propia del snapshot, o la
 * mediana histórica de su familia (D6 del doc de capacidad). null = sin
 * estimar (suma 0 a la cola y se señala aparte, sin inventar defaults).
 * Un 0 explícito SÍ es duración conocida — ver duracionDePaso en
 * flujo-produccion.ts, misma regla.
 */
function duracionDeTask(
  task: { step: StepView },
  medianas: Map<string, number>,
): number | null {
  const propia = task.step.paso.duracionEstimadaMin;
  if (propia != null) return propia;
  return medianas.get(task.step.paso.familiaCodigo) ?? null;
}

export function computeStationStats(
  tasks: StationTask[],
  incoming: IncomingTask[],
  medianas: Map<string, number>,
) {
  const blocked = tasks.filter((task) => task.isBlocked).length;
  const urgent = tasks.filter((task) => task.urgent && !task.isBlocked).length;
  const pending = tasks.length - blocked - urgent;
  const enCurso = tasks.filter((task) => task.isCurrent).length;
  const minDias = tasks.reduce<number | null>((min, task) => {
    const dias = task.item.dueDays;
    if (dias === null) return min;
    return min === null ? dias : Math.min(min, dias);
  }, null);

  // Cola en MINUTOS (incluye bloqueados: el trabajo no desaparece), con los
  // segmentos de la LoadBar ponderados por horas, no por conteo (doc §6).
  let colaMin = 0;
  let sinEstimar = 0;
  let pendingMin = 0;
  let urgentMin = 0;
  let blockedMin = 0;
  for (const task of tasks) {
    const duracion = duracionDeTask(task, medianas);
    if (duracion == null) {
      sinEstimar += 1;
      continue;
    }
    colaMin += duracion;
    if (task.isBlocked) blockedMin += duracion;
    else if (task.urgent) urgentMin += duracion;
    else pendingMin += duracion;
  }

  // Carga EN CAMINO (D10): pasos futuros de items vivos que caerán acá.
  // Se informa aparte de la cola, nunca sumada como si llegara ya (D11).
  let entranteMin = 0;
  for (const task of incoming) {
    const duracion = duracionDeTask(task, medianas);
    if (duracion == null) sinEstimar += 1;
    else entranteMin += duracion;
  }

  return {
    tasks,
    total: tasks.length,
    pending,
    urgent,
    blocked,
    enCurso,
    colaMin,
    sinEstimar,
    pendingMin,
    urgentMin,
    blockedMin,
    entranteMin,
    entranteCount: incoming.length,
    minDias,
    oldestBlocked: tasks.find((task) => task.isBlocked),
  };
}
