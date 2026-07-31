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
  id: string;
  indice: number;
  nombre: string;
  familiaCodigo: string;
  centroCostoId: string | null;
  /** Máquina que ejecutó el paso (rediseño de estaciones por reglas). */
  maquinaId?: string | null;
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
  id: string;
  ordenId: string;
  /** Número de OT — desempate final del scheduler (FIFO por emisión). */
  ordenNumero: string;
  ordenEstado: string;
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
): number | null {
  if (!fechaEntrega) return null;
  const [y, m, d] = fechaEntrega.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  const entrega = new Date(y, m - 1, d);
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((entrega.getTime() - hoy.getTime()) / 86_400_000);
}

/**
 * Prioridad DERIVADA del vencimiento (no hay campo real todavía):
 * vencida u hoy → urgente · ≤2 días → alta · resto → normal.
 */
export function prioridadDerivada(
  fechaEntrega: string | null,
  ahora: Date = new Date(),
): TableroPrioridad {
  const dias = diasHastaEntrega(fechaEntrega, ahora);
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
  return item.pasos
    .filter((otro) => otro.indice < paso.indice)
    .every((otro) => otro.estado === 'hecho');
}

type EstacionRuteo = {
  id: string;
  activo: boolean;
  familias: string[];
  maquinas: Array<{ id?: string | null; centroCostoId: string | null }>;
  reglas?: Array<{ tipo: string; valor: string }>;
};

/**
 * Ruteo paso → estación (rediseño "estaciones por reglas",
 * docs/estaciones-reglas-diseno.md). Prioridad de lo más específico a lo
 * general: 1) máquina del paso en la estación; 2) tecnología (regla); 3) paso
 * concreto (regla); 4) FALLBACK legacy familia + centro (intacto → neutral para
 * órdenes viejas y estaciones sin reglas). Espejo de src/lib/tablero-produccion.ts.
 */
export function resolverEstacionDePaso<T extends EstacionRuteo>(
  estaciones: T[],
  paso: Pick<
    TableroPasoData,
    'familiaCodigo' | 'centroCostoId' | 'maquinaId' | 'tecnologia'
  >,
): T | null {
  const activas = estaciones.filter((estacion) => estacion.activo);

  if (paso.maquinaId) {
    const porMaquina = activas.find((estacion) =>
      estacion.maquinas.some((maquina) => maquina.id === paso.maquinaId),
    );
    if (porMaquina) return porMaquina;
  }
  if (paso.tecnologia) {
    const porTecnologia = activas.find((estacion) =>
      (estacion.reglas ?? []).some(
        (regla) =>
          regla.tipo === 'tecnologia' && regla.valor === paso.tecnologia,
      ),
    );
    if (porTecnologia) return porTecnologia;
  }
  const porPaso = activas.find((estacion) =>
    (estacion.reglas ?? []).some(
      (regla) => regla.tipo === 'paso' && regla.valor === paso.familiaCodigo,
    ),
  );
  if (porPaso) return porPaso;

  // 4. Por familia: general (sin máquinas) o única candidata. Sin centro de
  //    costo (Fase D). Espejo de src/lib/tablero-produccion.ts.
  const candidatas = activas.filter((estacion) =>
    estacion.familias.includes(paso.familiaCodigo),
  );
  if (candidatas.length === 0) return null;
  const general = candidatas.find((estacion) => estacion.maquinas.length === 0);
  if (general) return general;
  if (candidatas.length === 1) return candidatas[0];
  return null;
}
