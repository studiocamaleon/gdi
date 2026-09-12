import {
  claveFechaEnZona,
  diasEntreClaves,
  ZONA_DEFAULT,
} from '../../common/zona';
/**
 * Espejo backend de src/lib/tablero-produccion.ts — SOLO lo que consume el
 * motor de simulación de flujo (ETA). Mantener en sync con el front: todo
 * cambio a estos tipos/funciones toca los dos lados y sus specs.
 *
 * El front tiene un `TableroPasoData`/`TableroItemData` más gordo (campos de
 * presentación y registro de tiempos). Acá viven sólo los campos que el motor
 * lee: la ficha de emisión/cron arma exactamente este subconjunto desde la DB.
 */

export type TableroPasoEstado =
  | 'pendiente'
  | 'en_curso'
  | 'pausado'
  | 'hecho'
  | 'bloqueado';

/** Campos de un paso que el motor de ETA necesita. */
export type TableroPasoData = {
  demandaHumana?: unknown;
  /** Intervalos registrados de ejecución; no incluyen pausas entre tramos. */
  tramosEjecucion?: Array<{ inicio: string; fin: string | null }>;
  /** Inicio aceptado del lote; la proyección no lo adelanta automáticamente. */
  planificadoDesde?: string | null;
  planificadoHasta?: string | null;
  atencionPlanificada?: unknown;
  id: string;
  indice: number;
  /** Null en OTs históricas; en órdenes nuevas habilita precedencia explícita. */
  nodoClave?: string | null;
  predecesorPasoIds?: string[];
  sucesorPasoIds?: string[];
  esTerminal?: boolean;
  nombre: string;
  familiaCodigo: string;
  plantillaCodigo?: string | null;
  centroCostoId: string | null;
  /** Máquina que ejecutó el paso (rediseño de estaciones por reglas). */
  maquinaId?: string | null;
  /** La familia exige máquina; una OT histórica sin id no se considera manual. */
  requiereMaquina?: boolean;
  /** Tecnología de esa máquina (derivada). */
  tecnologia?: string | null;
  duracionEstimadaMin: number | null;
  estado: TableroPasoEstado;
  /** ISO datetime o null (para el restante de un paso en curso). */
  iniciadoEl: string | null;
  /** 'interno' | 'tercerizado'. */
  tipoEjecucion: string;
  plazoProveedorDias: number | null;
};

/** Campos de un item que el motor de ETA necesita. */
export type TableroItemData = {
  /** Sólo escenarios internos; no se acepta desde la API. */
  prioridadPlanificacion?: number;
  id: string;
  ordenId: string;
  /** Número de OT — desempate final del scheduler (FIFO por emisión). */
  ordenNumero: string;
  ordenEstado: string;
  nombre?: string;
  parentItemId?: string | null;
  loteEntregaId?: string | null;
  /** ISO date o null (a nivel orden). */
  fechaEntrega: string | null;
  /** Item manual/histórico sin snapshot: no tiene ruta de producción. */
  sinRuta: boolean;
  pasos: TableroPasoData[];
};

export type TableroPrioridad = 'urgent' | 'high' | 'normal';

/** Clave del bucket de pasos sin estación asignada. */
export const SIN_ESTACION_KEY = 'sin-estacion';

/** Días entre la fecha de entrega (date-only ISO) y hoy. */
export function diasHastaEntrega(
  fechaEntrega: string | null,
  ahora: Date = new Date(),
  zona: string = ZONA_DEFAULT,
): number | null {
  if (!fechaEntrega) return null;
  return diasEntreClaves(
    claveFechaEnZona(ahora, zona),
    fechaEntrega.slice(0, 10),
  );
}

/**
 * Prioridad DERIVADA del vencimiento (no hay campo real todavía):
 * vencida u hoy → urgente · ≤2 días → alta · resto → normal.
 */
export function prioridadDerivada(
  fechaEntrega: string | null,
  ahora: Date = new Date(),
  zona: string = ZONA_DEFAULT,
): TableroPrioridad {
  const dias = diasHastaEntrega(fechaEntrega, ahora, zona);
  if (dias === null) return 'normal';
  if (dias <= 0) return 'urgent';
  if (dias <= 2) return 'high';
  return 'normal';
}

/**
 * La ruta es una SECUENCIA: el paso ACTIVO es el que está listo para hacerse
 * (es el primero o todos los anteriores ya están hechos).
 */
export function pasoActivo(
  item: TableroItemData,
  paso: TableroPasoData,
): boolean {
  if (paso.estado === 'hecho') return false;
  if (paso.nodoClave) {
    const porId = new Map(
      item.pasos.map((candidato) => [candidato.id, candidato]),
    );
    return (paso.predecesorPasoIds ?? []).every(
      (id) => porId.get(id)?.estado === 'hecho',
    );
  }
  return item.pasos
    .filter((otro) => otro.indice < paso.indice)
    .every((otro) => otro.estado === 'hecho');
}

type EstacionRuteo = {
  id: string;
  activo: boolean;
  familias: string[];
  maquinas: Array<{ id?: string | null; activo?: boolean; centroCostoId: string | null }>;
  /** Lectura compatible de asignaciones anteriores. Tecnología ya no asigna tareas. */
  reglas?: Array<{ tipo: string; valor: string }>;
};

type PasoRuteo = Pick<TableroPasoData,
  "familiaCodigo" | "plantillaCodigo" | "centroCostoId" | "maquinaId" | "tecnologia" | "requiereMaquina"
> & Partial<Pick<TableroPasoData, "tipoEjecucion">>;

/** Una máquina sólo se ejecuta donde está asignada. Las reglas de pasos se
 * aplican exclusivamente sin máquina. Una asignación propia prevalece sobre
 * la heredada de su plantilla; una ambigüedad nunca se resuelve por orden.
 * Mantener idéntico en frontend y backend. */
export function resolverEstacionDePaso<T extends EstacionRuteo>(
  estaciones: T[], paso: PasoRuteo,
): T | null {
  if (paso.tipoEjecucion === "tercerizado") return null;
  const activas = estaciones.filter((e) => e.activo);
  if (paso.maquinaId) {
    const candidatas = activas.filter((e) => e.maquinas.some(
      (m) => m.id === paso.maquinaId && m.activo !== false,
    ));
    return candidatas.length === 1 ? candidatas[0] : null;
  }
  // No confundir una OT incompleta con una operación manual.
  if (paso.requiereMaquina || paso.tecnologia) return null;
  for (const codigo of [paso.familiaCodigo, paso.plantillaCodigo]) {
    if (!codigo) continue;
    // Compatibilidad: la antigua regla explícita tiene prioridad sobre familia.
    const explicitas = activas.filter((e) => (e.reglas ?? []).some(
      (r) => r.tipo === "paso" && r.valor === codigo,
    ));
    if (explicitas.length) return explicitas.length === 1 ? explicitas[0] : null;
    const heredadas = activas.filter((e) => e.familias.includes(codigo));
    if (heredadas.length) return heredadas.length === 1 ? heredadas[0] : null;
  }
  return null;
}

export function motivoSinEstacion(estaciones: EstacionRuteo[], paso: PasoRuteo): string | null {
  if (paso.tipoEjecucion === "tercerizado" || resolverEstacionDePaso(estaciones, paso)) return null;
  if (paso.maquinaId) return "Asigná la máquina cotizada a una estación activa y verificá que la máquina esté habilitada.";
  if (paso.requiereMaquina || paso.tecnologia) return "Este paso requiere máquina, pero la orden no identifica cuál. Revisá su configuración de origen.";
  return "Asigná este paso sin máquina a una única estación activa; revisá si falta la asignación o está repetida.";
}
