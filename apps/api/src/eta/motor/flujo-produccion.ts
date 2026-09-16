import { precedenciasTanda, type TandaSimulada } from './precedencias-tanda';
import {
  contextoAtencion,
  guardarAtencion,
  leerAtencionPlanificada,
  type AtencionPlanificada,
} from './agenda-atencion';
import {
  programarAtencion,
  demandaPendiente,
  type TramoOperacion,
  type PlanAtencion,
  type ReservaHumana,
} from './capacidad-humana';
import {
  leerDemandaHumana,
  recortarDemanda,
  aplicarOperacionMaquina,
  leerModoOperacionMaquina,
  milisegundosDeMinutos,
} from './demanda-humana';
import { finConflictoReserva } from './eta-reservas';
/**
 * Simulación de flujo del taller (Fase 2b) — motor puro y determinista.
 *
 * Le pone TIEMPO a la carga en camino: programa los pasos restantes de
 * cada item contra las estaciones reales (calendario + puestos) con
 * list-scheduling de capacidad finita, y devuelve la fecha estimada de
 * fin por item y la hora estimada de llegada de cada paso futuro a su
 * estación. No es un scheduler óptimo: es una aproximación honesta para
 * ETAs operativas. Ver docs/simulacion-flujo-diseno.md
 *
 * ESPEJO de src/lib/flujo-produccion.ts (mismo motor puro). Todo cambio a
 * la aritmética o al scheduler toca los DOS lados y sus specs.
 */

import {
  DIAS_SEMANA,
  type CalendarioDia,
  type CalendarioEstacion,
} from '../../produccion/calendario';
import { calendarioDefault, type Estacion } from './estaciones-tipos';
import {
  prioridadDerivada,
  resolverEstacionDePaso,
  SIN_ESTACION_KEY,
  type TableroItemData,
  type TableroPasoData,
} from './tablero-tipos';
import {
  claveFechaEnZona,
  diaSemanaDeClave,
  instanteDe,
  partesEnZona,
  sumarDiasAClave,
  ZONA_DEFAULT,
} from '../../common/zona';

/** Horizonte de búsqueda de ventanas laborales (D8). */
const HORIZONTE_DIAS = 120;

/** Piso de minutos restantes de un paso en curso (D3). */
const MIN_RESTANTE_EN_CURSO = 5;

export type SimulacionItem = {
  motivoSinEstimar?: string;
  /** null = sin ETA (sin estimar, o sin ventana en el horizonte). */
  finEstimado: Date | null;
  /** Algún paso sin duración propia ni mediana: no se inventa ETA (D6). */
  sinEstimar: boolean;
  /** Corrió con supuestos: estación sin calendario o paso sin estación (D5). */
  parcial: boolean;
  /** Tiene un paso bloqueado: la ETA asume desbloqueo inmediato (D4). */
  asumeDesbloqueo: boolean;
};

export type LlegadaEstacion = {
  pasoId: string;
  itemId: string;
  /** Momento estimado en que el paso queda LISTO en su estación. */
  llegada: Date;
  duracionMin: number;
};

/** Clave del carril sintético de los pasos que hace un proveedor. */
export const PROVEEDOR_KEY = '__proveedor__';

/**
 * Un paso ya colocado en el plan: el registro de UNA decisión del
 * scheduler. El motor calculaba todo esto y lo descartaba; anotarlo es
 * lo que permite mostrar la simulación en vez de sólo su resultado.
 */
export type PasoProgramado = {
  atencionPlanificada?: AtencionPlanificada;
  equipoProduccionId?: string | null;
  reservasHumanas?: ReservaHumana[];
  tramosOperacion?: TramoOperacion[];
  /** El avance se proyecta con los tramos registrados y las fases cotizadas. */
  faseEnCursoEstimada?: boolean;
  /** Orden en que el scheduler tomó la decisión — NO es cronológico. */
  orden: number;
  itemId: string;
  pasoId: string;
  pasoIndice: number;
  /** Dependencias reales resueltas por el scheduler, incluso entre items. */
  predecesorPasoIds: string[];
  /** Id de estación, o SIN_ESTACION_KEY / PROVEEDOR_KEY. */
  estacionKey: string;
  inicio: Date;
  fin: Date;
  /** Minutos de taller. null en tercerizados: su costo es el lead time. */
  duracionMin: number | null;
  /** Minutos de separación DESPUÉS del paso, antes del siguiente en el mismo
   *  recurso (cambio de material, traslado). Se ve como aire entre bloques. */
  preparacionMin: number;
  plazoDias: number | null;
  /** Cuánto esperó el trabajo a que se liberara un puesto. */
  esperaMin: number;
  /** Corrió con calendario asumido o sin estación real. */
  parcial: boolean;
  tercerizado: boolean;
  /** Ya estaba en curso al arrancar la simulación. */
  enCurso: boolean;
  /** Candidatos que competían por el puesto en ese turno. */
  candidatos: number | null;
};

export type ResultadoSimulacion = {
  porItem: Map<string, SimulacionItem>;
  llegadasPorEstacion: Map<string, LlegadaEstacion[]>;
  /** El plan completo, en orden de decisión. */
  traza: PasoProgramado[];
};

// ── Aritmética de calendario ─────────────────────────────────────────────

/**
 * Las franjas de una FECHA de pared ("2026-07-27"). El calendario habla en
 * hora de pared del taller; qué día de la semana es una fecha ya no depende
 * de ninguna zona.
 */
function franjasDeClave(
  calendario: CalendarioEstacion,
  clave: string,
  noLaborables: Set<string>,
): CalendarioDia {
  if (noLaborables.has(clave)) return [];
  return calendario.dias[diaSemanaDeClave(clave)] ?? [];
}

/**
 * Avanza `t` al próximo instante laboral (t mismo si ya cae dentro de una
 * franja del día — puede haber varias: jornada cortada). null si no hay
 * ventana en el horizonte (D8).
 *
 * `zona` es la zona IANA del taller: el "08:00" del calendario es hora de
 * pared AHÍ, no del proceso — el server corre en UTC y el navegador en la
 * zona de quien mire (multi-moneda-zona-horaria D10).
 */
export function avanzarAVentana(
  calendario: CalendarioEstacion,
  t: Date,
  noLaborables: Set<string> = new Set(),
  zona: string = ZONA_DEFAULT,
): Date | null {
  const claveT = claveFechaEnZona(t, zona);
  for (let i = 0; i < HORIZONTE_DIAS; i += 1) {
    const clave = i === 0 ? claveT : sumarDiasAClave(claveT, i);
    for (const franja of franjasDeClave(calendario, clave, noLaborables)) {
      const inicio = instanteDe(clave, franja.desde, zona);
      const fin = instanteDe(clave, franja.hasta, zona);
      const candidato = i === 0 && t > inicio ? t : inicio;
      if (candidato < fin) return candidato;
    }
  }
  return null;
}

/**
 * El cierre de la franja que contiene a `t` (que ya debe caer dentro de una:
 * es el invariante de avanzarAVentana). null si t no cae en ninguna.
 */
function finDeFranjaActual(
  calendario: CalendarioEstacion,
  t: Date,
  noLaborables: Set<string>,
  zona: string,
): Date | null {
  const clave = claveFechaEnZona(t, zona);
  for (const franja of franjasDeClave(calendario, clave, noLaborables)) {
    const inicio = instanteDe(clave, franja.desde, zona);
    const fin = instanteDe(clave, franja.hasta, zona);
    if (t >= inicio && t < fin) return fin;
  }
  return null;
}

/**
 * Suma minutos laborales desde `desde` (se avanza solo a ventana si hace
 * falta), saltando cierres, cortes de mediodía y días sin franjas. null si
 * el horizonte no alcanza.
 */
export function sumarMinutosLaborales(
  calendario: CalendarioEstacion,
  desde: Date,
  minutos: number,
  noLaborables: Set<string> = new Set(),
  zona: string = ZONA_DEFAULT,
): Date | null {
  let t = avanzarAVentana(calendario, desde, noLaborables, zona);
  let restante = milisegundosDeMinutos(minutos);
  // Antes la guardia contaba días; con jornada cortada hay más de una
  // iteración por día (una por franja).
  let guardia = 0;
  const limite = (HORIZONTE_DIAS + 7) * 6;
  while (t && guardia < limite) {
    guardia += 1;
    const finVentana = finDeFranjaActual(calendario, t, noLaborables, zona);
    if (!finVentana) {
      t = avanzarAVentana(calendario, t, noLaborables, zona);
      continue;
    }
    const disponibles = finVentana.getTime() - t.getTime();
    if (restante <= disponibles) return new Date(t.getTime() + restante);
    restante -= disponibles;
    t = avanzarAVentana(calendario, finVentana, noLaborables, zona);
  }
  return null;
}

// ── Motor ────────────────────────────────────────────────────────────────

/** Tramos efectivos; nunca reserva personas durante noches o cierres. */
function tramosLaborales(
  calendario: CalendarioEstacion,
  desde: Date,
  minutos: number,
  noLaborables: Set<string>,
  zona: string,
): Array<{ inicio: number; fin: number }> | null {
  let t = avanzarAVentana(calendario, desde, noLaborables, zona),
    restante = milisegundosDeMinutos(minutos);
  const tramos: Array<{ inicio: number; fin: number }> = [];
  for (let i = 0; t && i < (HORIZONTE_DIAS + 7) * 6; i++) {
    const cierre = finDeFranjaActual(calendario, t, noLaborables, zona);
    if (!cierre) return null;
    const consumo = Math.min(restante, cierre.getTime() - t.getTime());
    if (consumo > 0)
      tramos.push({
        inicio: t.getTime(),
        fin: t.getTime() + consumo,
      });
    restante -= consumo;
    if (restante <= 0) return tramos;
    t = avanzarAVentana(calendario, cierre, noLaborables, zona);
  }
  return null;
}

type EstacionSim = {
  key: string;
  calendario: CalendarioEstacion;
  /** null = sin restricción de capacidad (bucket "sin estación", D5). */
  servers: Date[] | null;
  equipo?: Estacion['equipoProduccion'];
  empleados?: import('./estaciones-tipos').PersonaProduccion[];
  /** Corre con supuestos (calendario default o sin estación). */
  parcial: boolean;
  /** Una capacidad por máquina física, compartida por toda la simulación. */
  maquinas: Map<string, Date[]>;
  /** Minutos de traslado/preparación antes de poder empezar acá. */
  preparacionMin: number;
};

/**
 * Un paso tercerizado no se produce acá: lo hace un proveedor, en su propio
 * calendario y sin ocupar un puesto del taller. Su costo en tiempo es el lead
 * time (`plazoProveedorDias`), no minutos de estación.
 */
function esTercerizado(paso: TableroPasoData): boolean {
  return paso.tipoEjecucion === 'tercerizado';
}

function duracionDePaso(
  paso: TableroPasoData,
  medianas: Map<string, number>,
): number | null {
  // Un tercerizado nunca toma la mediana de la familia: esa mediana se midió
  // sobre pasos INTERNOS y no dice nada del proveedor. Se programa aparte.
  if (esTercerizado(paso)) return null;
  // Ojo con el cero: 0 es una duración REAL ("Material sin impresión" sale del
  // motor con tiempoCero), distinta de null = "no sabemos cuánto tarda". Sólo
  // null cae a la mediana; tratar el 0 como desconocido dejaba sin ETA a toda
  // la orden, o peor, le sumaba la mediana de impresión a un paso que no imprime.
  if (paso.duracionEstimadaMin != null) return paso.duracionEstimadaMin;
  return medianas.get(paso.familiaCodigo) ?? null;
}

function calendarioVacio(calendario: CalendarioEstacion | null): boolean {
  if (!calendario) return true;
  return DIAS_SEMANA.every((dia) => {
    const franjas = calendario.dias[dia];
    return franjas === null || franjas.length === 0;
  });
}

export function simularFlujo({
  items,
  tandas = [],
  estaciones,
  medianas,
  ahora = new Date(),
  noLaborables = new Set<string>(),
  tiempoEntrePasosMin = 0,
  zona = ZONA_DEFAULT,
}: {
  items: TableroItemData[];
  /** Sólo escenarios internos de preparación; no publica cambios. */
  tandas?: TandaSimulada[];
  estaciones: Estacion[];
  medianas: Map<string, number>;
  ahora?: Date;
  noLaborables?: Set<string>;
  /** Default del tenant para las estaciones que no declaran el suyo. */
  tiempoEntrePasosMin?: number;
  /**
   * Zona IANA del taller: los "08:00" del calendario y las claves de los
   * feriados son hora de pared AHÍ. Sin pasarla se asume Argentina, que
   * además unifica el resultado entre el server (UTC) y el navegador.
   */
  zona?: string;
}): ResultadoSimulacion {
  // La configuración vigente también gobierna propuestas previas a la OT.
  const modosMaquina = new Map(
    estaciones.flatMap((e) =>
      e.maquinas.flatMap((m) =>
        m.id && 'operacionMaquina' in m
          ? [[m.id, leerModoOperacionMaquina(m.operacionMaquina)] as const]
          : [],
      ),
    ),
  );
  const demandaDePaso = (paso: TableroPasoData, total: number) => {
    const base = leerDemandaHumana(paso.demandaHumana, total);
    return paso.maquinaId && modosMaquina.has(paso.maquinaId)
      ? aplicarOperacionMaquina(base, modosMaquina.get(paso.maquinaId) ?? null)
      : base;
  };
  const porItem = new Map<string, SimulacionItem>();
  const llegadasPorEstacion = new Map<string, LlegadaEstacion[]>();
  const traza: PasoProgramado[] = [];
  const anotar = (p: Omit<PasoProgramado, 'orden'>) =>
    traza.push({ orden: traza.length, ...p });

  // Estaciones simulables: las activas, con calendario default si falta (D5).
  const registros = new Map<string, EstacionSim>();
  const maquinasGlobales = new Map<string, Date[]>();
  for (const estacion of estaciones) {
    if (!estacion.activo) continue;
    const sinCalendario = calendarioVacio(estacion.calendario);
    registros.set(estacion.id, {
      key: estacion.id,
      equipo: estacion.planificacionPorEmpleados
        ? null
        : estacion.equipoProduccion,
      empleados: estacion.planificacionPorEmpleados
        ? (estacion.empleados ?? []).map((e) => ({
            id: e.id,
            activo: e.activo,
            calendario: e.calendario ?? null,
          }))
        : undefined,
      calendario: sinCalendario
        ? calendarioDefault()
        : (estacion.calendario as CalendarioEstacion),
      servers: estacion.planificacionPorEmpleados
        ? null
        : Array.from(
            { length: Math.max(1, estacion.capacidadConcurrente) },
            () => new Date(ahora),
          ),
      parcial: sinCalendario,
      maquinas: maquinasGlobales,
      preparacionMin: Math.max(
        0,
        estacion.tiempoPreparacionMin ?? tiempoEntrePasosMin,
      ),
    });
  }
  const sinEstacion: EstacionSim = {
    key: SIN_ESTACION_KEY,
    calendario: calendarioDefault(),
    servers: null,
    parcial: true,
    maquinas: maquinasGlobales,
    preparacionMin: Math.max(0, tiempoEntrePasosMin),
  };

  const estacionDe = (paso: TableroPasoData): EstacionSim => {
    const resuelta = resolverEstacionDePaso(estaciones, paso);
    const base = (resuelta && registros.get(resuelta.id)) || sinEstacion;
    const ids = paso.personalFijo?.empleadoIds;
    // La agenda aceptada y la proyección deben reservar el mismo personal fijo.
    return ids && base.empleados !== undefined
      ? { ...base, empleados: base.empleados.filter((e) => ids.includes(e.id)) }
      : base;
  };

  // La unidad del scheduler deja de ser "el próximo índice de un item" y pasa
  // a ser un nodo cuyas precedencias ya tienen fecha. Así tres ramas pueden
  // competir por estaciones distintas y una convergencia toma el máximo de
  // sus predecesores. Para datos históricos se deriva A → B → C por índice.
  const pasoPorId = new Map(
    items.flatMap((item) =>
      item.pasos.map((paso) => [paso.id, { item, paso }] as const),
    ),
  );
  const contextoDeAtencion = (
    paso: TableroPasoData,
    est: EstacionSim,
    total: number,
  ) =>
    contextoAtencion({
      demanda: recortarDemanda(demandaDePaso(paso, total), total, total),
      calendario: est.calendario,
      equipo: est.equipo,
      empleados: est.empleados,
      preparacionMin: est.preparacionMin,
      zona,
      noLaborables,
    });
  // Se indexa una vez. La cola sin agenda publicada conserva el costo del motor original.
  const reservasPorEstacion = new Map<
    string,
    { paso: TableroPasoData; inicio: number; fin: number }[]
  >();
  for (const { paso } of pasoPorId.values()) {
    if (
      paso.estado !== 'pendiente' ||
      !paso.planificadoDesde ||
      !paso.planificadoHasta ||
      esTercerizado(paso)
    )
      continue;
    const est = estacionDe(paso),
      inicio = new Date(paso.planificadoDesde).getTime();
    const total = duracionDePaso(paso, medianas);
    const guardada =
      total == null
        ? null
        : leerAtencionPlanificada(
            paso.atencionPlanificada,
            contextoDeAtencion(paso, est, total),
            inicio,
            new Date(paso.planificadoHasta).getTime(),
          );
    const fin =
      guardada?.finOcupacion ??
      (
        sumarMinutosLaborales(
          est.calendario,
          new Date(paso.planificadoHasta),
          est.preparacionMin,
          noLaborables,
          zona,
        ) ?? new Date(paso.planificadoHasta)
      ).getTime();
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio)
      continue;
    const reservas = reservasPorEstacion.get(est.key) ?? [];
    reservas.push({ paso, inicio, fin });
    reservasPorEstacion.set(est.key, reservas);
  }
  const proyectar = (c: CalendarioEstacion, d: Date, m: number) =>
    tramosLaborales(c, d, m, noLaborables, zona);
  // Puente conservador mientras se configura cada estación del antiguo equipo.
  // Una reserva anónima anterior bloquea a sus miembros ya identificados;
  // una reserva personal descuenta esos mismos cupos de los equipos anteriores.
  const personasPorEquipo = new Map<string, Set<string>>();
  for (const e of estaciones)
    if (e.planificacionPorEmpleados && e.equipoProduccionId) {
      const ids =
        personasPorEquipo.get(e.equipoProduccionId) ?? new Set<string>();
      for (const persona of e.empleados ?? []) ids.add(persona.id);
      personasPorEquipo.set(e.equipoProduccionId, ids);
    }
  const agregarReservas = (
    mapa: Map<string, ReservaHumana[]>,
    est: EstacionSim,
    reservas: ReservaHumana[],
  ) => {
    const agregar = (key: string, lista: ReservaHumana[]) => {
      mapa.set(key, [...(mapa.get(key) ?? []), ...lista]);
    };
    if (est.empleados !== undefined) {
      agregar('@empleados', reservas);
      for (const [equipoId, ids] of personasPorEquipo) {
        agregar(
          equipoId,
          reservas.flatMap((r) => {
            const comunes = (r.empleadoIds ?? []).filter((id) => ids.has(id));
            return comunes.length ? [{ ...r, personas: comunes.length }] : [];
          }),
        );
      }
    } else if (est.equipo) {
      agregar(est.equipo.id, reservas);
      const ids = [...(personasPorEquipo.get(est.equipo.id) ?? [])];
      if (ids.length) {
        const activas = reservas.filter((r) => r.personas > 0);
        agregar(
          '@empleados',
          activas.map((r) => ({
            ...r,
            personas: ids.length,
            empleadoIds: ids,
          })),
        );
        for (const [otroEquipo, otras] of personasPorEquipo) {
          if (otroEquipo === est.equipo.id) continue;
          const comunes = ids.filter((id) => otras.has(id));
          if (comunes.length)
            agregar(
              otroEquipo,
              activas.map((r) => ({ ...r, personas: comunes.length })),
            );
        }
      }
    }
  };
  const ocupacionEquipos = new Map<string, ReservaHumana[]>();
  const agendaEquipos = new Map<string, ReservaHumana[]>();
  for (const reservas of reservasPorEstacion.values())
    for (const r of reservas) {
      const est = estacionDe(r.paso);
      if (!est.equipo && est.empleados === undefined) continue;
      const total = duracionDePaso(r.paso, medianas);
      if (total == null) continue;
      const demanda = recortarDemanda(
        demandaDePaso(r.paso, total),
        total,
        total,
      );
      const plan = programarAtencion({
        desde: new Date(r.inicio),
        demanda,
        equipo: est.equipo,
        empleados: est.empleados,
        calendario: est.calendario,
        reservas: [],
        preparacionMin: est.preparacionMin,
        proyectar,
      });
      // Una agenda antigua puede incluir esperas sin guardar fases. Reservar
      // el máximo de personas es conservador hasta volver a proyectarla.
      const guardada = leerAtencionPlanificada(
        r.paso.atencionPlanificada,
        contextoDeAtencion(r.paso, est, total),
        r.inicio,
        new Date(r.paso.planificadoHasta!).getTime(),
      );
      const intervalos =
        est.empleados !== undefined && !guardada
          ? [
              {
                inicio: r.inicio,
                fin: r.fin,
                personas: est.empleados.length,
                empleadoIds: est.empleados.map((e) => e.id),
              },
            ]
          : guardada
            ? guardada.reservas
            : plan && plan.finOcupacion.getTime() === r.fin
              ? plan.reservas
              : [
                  {
                    inicio: r.inicio,
                    fin: r.fin,
                    personas: Math.max(
                      1,
                      ...demanda.fases.map((f) => f.personas),
                    ),
                  },
                ];
      agregarReservas(
        agendaEquipos,
        est,
        intervalos.map((v) => ({ ...v, pasoId: r.paso.id })),
      );
    }
  const predecesores = new Map<string, string[]>();
  for (const item of items) {
    const ordenados = [...item.pasos].sort((a, b) => a.indice - b.indice);
    for (let i = 0; i < ordenados.length; i += 1) {
      const paso = ordenados[i];
      predecesores.set(
        paso.id,
        paso.nodoClave
          ? (paso.predecesorPasoIds ?? [])
          : i > 0
            ? [ordenados[i - 1].id]
            : [],
      );
    }
  }

  const liberacionTanda = !tandas.length
    ? new Map<string, string>()
    : precedenciasTanda(
        [...pasoPorId.values()].map((n) => n.paso),
        predecesores,
        tandas,
      );

  const resultadoDe = (item: TableroItemData) => {
    let resultado = porItem.get(item.id);
    if (!resultado) {
      resultado = {
        finEstimado: null,
        sinEstimar: false,
        parcial: false,
        asumeDesbloqueo: item.pasos.some((paso) => paso.estado === 'bloqueado'),
      };
      porItem.set(item.id, resultado);
    }
    return resultado;
  };
  for (const item of items) {
    if (!item.sinRuta && item.pasos.some((paso) => paso.estado !== 'hecho'))
      resultadoDe(item);
  }

  const programados = new Set<string>();
  const finTrabajo = new Map<string, Date>();
  const disponibleDesde = new Map<string, Date>();
  for (const { paso } of pasoPorId.values()) {
    if (paso.estado !== 'hecho') continue;
    programados.add(paso.id);
    finTrabajo.set(paso.id, new Date(ahora));
    disponibleDesde.set(paso.id, new Date(ahora));
  }

  const pendientes = new Set(
    [...pasoPorId.values()]
      .filter(({ paso }) => paso.estado !== 'hecho')
      .map(({ paso }) => paso.id),
  );
  const itemsSinEstimacion = new Set<string>();
  const itemsSinVentana = new Set<string>();
  type Candidato = {
    item: TableroItemData;
    paso: TableroPasoData;
    listo: Date;
    inicio: Date;
    est: EstacionSim | null;
    duracion: number | null;
    atencion?: PlanAtencion;
  };
  const prioridadItems = new Map(
    items.map((item) => [
      item.id,
      {
        urgente: prioridadDerivada(item.fechaEntrega, ahora, zona) === 'urgent',
        entrega: item.fechaEntrega
          ? new Date(item.fechaEntrega).getTime()
          : Number.POSITIVE_INFINITY,
      },
    ]),
  );
  // Duración, atención pendiente y ruteo son constantes durante esta simulación.
  const preparados = new Map<
    string,
    {
      est: EstacionSim;
      demanda: ReturnType<typeof recortarDemanda>;
      claveDemanda: string;
    }
  >();
  const esMejor = (a: Candidato, b: Candidato) => {
    if ((a.paso.estado === 'en_curso') !== (b.paso.estado === 'en_curso'))
      return a.paso.estado === 'en_curso';
    if (a.inicio.getTime() !== b.inicio.getTime()) return a.inicio < b.inicio;
    const pa = a.item.prioridadPlanificacion ?? 0,
      pb = b.item.prioridadPlanificacion ?? 0;
    if (pa !== pb) return pa < pb;
    // Si dos trabajos disputan el mismo hueco, atiende primero al que lleva
    // más tiempo listo. Evita que una rama recién liberada se adelante a una
    // OT que ya esperaba por ese puesto.
    if (a.listo.getTime() !== b.listo.getTime()) return a.listo < b.listo;
    const prioridadA = prioridadItems.get(a.item.id)!;
    const prioridadB = prioridadItems.get(b.item.id)!;
    if (prioridadA.urgente !== prioridadB.urgente) return prioridadA.urgente;
    const entregaA = prioridadA.entrega,
      entregaB = prioridadB.entrega;
    if (entregaA !== entregaB) return entregaA < entregaB;
    if (a.item.ordenNumero !== b.item.ordenNumero)
      return a.item.ordenNumero < b.item.ordenNumero;
    return a.paso.indice < b.paso.indice;
  };

  let guardia = 0;
  const limite = pendientes.size * 3 + 8;
  while (pendientes.size > 0 && guardia < limite) {
    guardia += 1;
    let mejor: Candidato | null = null;
    let candidatos = 0;
    let marcoSinEstimacion = false;
    // Dentro de esta decisión las reservas no cambian. Las operaciones con
    // igual demanda/estación/inicio comparten la evaluación humana, no su identidad.
    const atencionesEquivalentes = new Map<string, PlanAtencion | null>();
    const colocacionesEquivalentes = new Map<string, Candidato>();

    for (const pasoId of pendientes) {
      const nodo = pasoPorId.get(pasoId)!;
      if (
        itemsSinEstimacion.has(nodo.item.id) ||
        itemsSinVentana.has(nodo.item.id)
      )
        continue;
      const previos = predecesores.get(pasoId) ?? [];
      if (!previos.every((id) => programados.has(id))) continue;
      const inicioLote = nodo.paso.planificadoDesde
        ? new Date(nodo.paso.planificadoDesde)
        : ahora;
      const baseInicio =
        Number.isFinite(inicioLote.getTime()) &&
        inicioLote > ahora &&
        nodo.paso.estado !== 'en_curso'
          ? inicioLote
          : ahora;
      const listo = previos.reduce((max, id) => {
        const fecha = disponibleDesde.get(id) ?? ahora;
        return fecha > max ? fecha : max;
      }, new Date(baseInicio));

      if (esTercerizado(nodo.paso)) {
        if (
          nodo.paso.plazoProveedorDias == null ||
          nodo.paso.plazoProveedorDias < 0
        ) {
          resultadoDe(nodo.item).sinEstimar = true;
          itemsSinEstimacion.add(nodo.item.id);
          marcoSinEstimacion = true;
          continue;
        }
        const candidato: Candidato = {
          ...nodo,
          listo,
          inicio: listo,
          est: null,
          duracion: null,
        };
        candidatos += 1;
        if (!mejor || esMejor(candidato, mejor)) mejor = candidato;
        continue;
      }

      const duracionBase = duracionDePaso(nodo.paso, medianas);
      if (duracionBase == null) {
        resultadoDe(nodo.item).sinEstimar = true;
        itemsSinEstimacion.add(nodo.item.id);
        marcoSinEstimacion = true;
        continue;
      }
      const enCurso = nodo.paso.estado === 'en_curso';
      let preparado = preparados.get(pasoId);
      if (!preparado) {
        const est = estacionDe(nodo.paso);
        const congelada = demandaDePaso(nodo.paso, duracionBase);
        let demanda = recortarDemanda(congelada, duracionBase, duracionBase);
        const ejecucion = nodo.paso.tramosEjecucion?.length
          ? nodo.paso.tramosEjecucion
          : enCurso && nodo.paso.iniciadoEl
            ? [{ inicio: nodo.paso.iniciadoEl, fin: null }]
            : [];
        if (ejecucion.length) {
          demanda = demandaPendiente({
            demanda,
            ejecucion,
            ahora,
            calendario: est.calendario,
            equipo: est.equipo,
            empleados: est.empleados,
            proyectar,
          });
          // Sin confirmación de fin no se da por terminado ni se repite el setup.
          if (demanda.fases.reduce((s, f) => s + f.minutos, 0) < 0.00001)
            demanda = {
              version: 1,
              verificada: false,
              fases: [
                {
                  minutos: MIN_RESTANTE_EN_CURSO,
                  personas: Math.max(
                    1,
                    ...(congelada?.fases.map((f) => f.personas) ?? []),
                  ),
                },
              ],
            };
        }
        preparado = {
          est,
          demanda,
          claveDemanda: JSON.stringify([demanda, nodo.paso.personalFijo]),
        };
        preparados.set(pasoId, preparado);
      }
      const { est, demanda } = preparado;
      const duracion = demanda.fases.reduce((s, f) => s + f.minutos, 0);
      // Sin reservas publicadas, misma máquina/estación, llegada y demanda
      // producen la misma ventana. Sólo cambia la identidad y prioridad del paso.
      const claveColocacion =
        reservasPorEstacion.size || enCurso
          ? null
          : `${est.key}|${nodo.paso.maquinaId ?? ''}|${listo.getTime()}|${preparado.claveDemanda}`;
      const equivalente =
        claveColocacion === null
          ? null
          : colocacionesEquivalentes.get(claveColocacion);
      if (equivalente) {
        const candidato = { ...equivalente, ...nodo };
        candidatos += 1;
        if (!mejor || esMejor(candidato, mejor)) mejor = candidato;
        continue;
      }
      // Los puestos son capacidad física MANUAL. Cada máquina tiene su pool.
      const puestos = nodo.paso.maquinaId ? null : est.servers;
      const libreDesde = puestos
        ? puestos.reduce(
            (min, fecha) => (fecha < min ? fecha : min),
            puestos[0],
          )
        : listo;
      const pool = poolDeMaquina(est, nodo.paso, ahora);
      const maquinaLibre = pool
        ? pool.reduce((min, fecha) => (fecha < min ? fecha : min), pool[0])
        : null;
      let inicioCrudo = enCurso
        ? new Date(ahora)
        : libreDesde > listo
          ? libreDesde
          : listo;
      if (!enCurso && maquinaLibre && maquinaLibre > inicioCrudo)
        inicioCrudo = maquinaLibre;
      let inicio = avanzarAVentana(
        est.calendario,
        inicioCrudo,
        noLaborables,
        zona,
      );
      const reservas = (reservasPorEstacion.get(est.key) ?? []).filter(
        (r) => r.paso.id !== nodo.paso.id && !programados.has(r.paso.id),
      );
      const agendaHumana =
        est.empleados !== undefined || est.equipo
          ? (agendaEquipos.get(
              est.empleados !== undefined ? '@empleados' : est.equipo!.id,
            ) ?? [])
          : [];
      const ocupadasHumanas =
        est.empleados !== undefined || est.equipo
          ? (ocupacionEquipos.get(
              est.empleados !== undefined ? '@empleados' : est.equipo!.id,
            ) ?? [])
          : [];
      const reservasHumanas = agendaHumana.length
        ? [
            ...ocupadasHumanas,
            ...agendaHumana.filter(
              (r) => r.pasoId !== nodo.paso.id && !programados.has(r.pasoId!),
            ),
          ]
        : ocupadasHumanas;
      let atencion: PlanAtencion | null = null;
      for (
        let intento = 0;
        inicio && intento <= reservas.length * 2 + 2;
        intento++
      ) {
        // Con agenda publicada cada paso excluye su propia reserva: no se
        // comparte esa evaluación. El cache se descarta al elegir cada paso.
        const claveAtencion = agendaHumana.length
          ? null
          : `${est.key}|${inicio.getTime()}|${JSON.stringify([demanda, nodo.paso.personalFijo])}`;
        if (
          claveAtencion !== null &&
          atencionesEquivalentes.has(claveAtencion)
        ) {
          atencion = atencionesEquivalentes.get(claveAtencion)!;
        } else {
          atencion = programarAtencion({
            desde: inicio,
            demanda,
            calendario: est.calendario,
            equipo: est.equipo,
            empleados: est.empleados,
            obligatorioId:
              nodo.paso.personalFijo?.obligatorioId ??
              (nodo.paso.iniciadoEl
                ? nodo.paso.personalFijo?.preferidoId
                : undefined),
            preferidoId: nodo.paso.personalFijo?.preferidoId,
            reservas: reservasHumanas,
            preparacionMin: est.preparacionMin,
            proyectar,
          });
          if (claveAtencion !== null)
            atencionesEquivalentes.set(claveAtencion, atencion);
        }
        if (!atencion) {
          inicio = null;
          break;
        }
        inicio = atencion.inicio;
        if (enCurso) break;
        const finOcupacion = atencion.finOcupacion.getTime();
        const ocupados = (puestos ?? []).map((fin) => ({
          inicio: ahora.getTime(),
          fin: fin.getTime(),
        }));
        const conflictoEstacion = puestos
          ? finConflictoReserva(
              inicio.getTime(),
              finOcupacion,
              [...reservas.filter((r) => !r.paso.maquinaId), ...ocupados],
              puestos.length,
            )
          : null;
        const mismaMaquina = reservas.filter(
          (r) => claveMaquina(est, r.paso) === claveMaquina(est, nodo.paso),
        );
        const conflictoMaquina = pool
          ? finConflictoReserva(
              inicio.getTime(),
              finOcupacion,
              [
                ...mismaMaquina,
                ...pool.map((fin) => ({
                  inicio: ahora.getTime(),
                  fin: fin.getTime(),
                })),
              ],
              pool.length,
            )
          : null;
        const avanzar = Math.max(conflictoEstacion ?? 0, conflictoMaquina ?? 0);
        if (!avanzar) break;
        inicio = avanzarAVentana(
          est.calendario,
          new Date(avanzar),
          noLaborables,
          zona,
        );
        if (intento === reservas.length * 2 + 2) inicio = null;
      }
      if (!inicio || !atencion) {
        itemsSinVentana.add(nodo.item.id);
        resultadoDe(nodo.item).motivoSinEstimar =
          est.empleados !== undefined
            ? `No se pudo programar «${nodo.paso.nombre}» con la dotación requerida, los horarios y las reservas disponibles.`
            : est.equipo
              ? 'No hay capacidad suficiente del equipo o una ventana común con la estación.'
              : 'No hay una ventana de producción en el horizonte.';
        marcoSinEstimacion = true;
        continue;
      }
      const candidato: Candidato = {
        ...nodo,
        listo,
        inicio,
        est,
        duracion,
        atencion,
      };
      if (claveColocacion !== null)
        colocacionesEquivalentes.set(claveColocacion, candidato);
      candidatos += 1;
      if (!mejor || esMejor(candidato, mejor)) mejor = candidato;
    }

    if (!mejor) {
      if (marcoSinEstimacion) continue;
      break;
    }

    const { item, paso, listo, inicio, est, duracion } = mejor;
    let fin: Date;
    let finSeparado: Date;
    let preparacionMin = 0;
    if (esTercerizado(paso)) {
      fin = sumarDiasHabiles(
        listo,
        paso.plazoProveedorDias!,
        noLaborables,
        zona,
      );
      finSeparado = fin;
    } else {
      fin = mejor.atencion!.fin;
      finSeparado = mejor.atencion!.finOcupacion;
      preparacionMin = est!.preparacionMin;
      agregarReservas(
        ocupacionEquipos,
        est!,
        mejor.atencion!.reservas.map((r) => ({ ...r, pasoId: paso.id })),
      );
      if (!paso.maquinaId) ocupar(est!, finSeparado);
      ocuparMaquina(est!, paso, finSeparado, ahora);
      if (est!.parcial || mejor.atencion?.parcial)
        resultadoDe(item).parcial = true;
    }

    programados.add(paso.id);
    pendientes.delete(paso.id);
    finTrabajo.set(paso.id, fin);
    disponibleDesde.set(paso.id, finSeparado);
    anotar({
      itemId: item.id,
      pasoId: paso.id,
      pasoIndice: paso.indice,
      predecesorPasoIds: [...(predecesores.get(paso.id) ?? [])],
      estacionKey: esTercerizado(paso) ? PROVEEDOR_KEY : est!.key,
      inicio,
      fin,
      duracionMin: duracion,
      preparacionMin,
      plazoDias: esTercerizado(paso) ? paso.plazoProveedorDias : null,
      esperaMin: Math.max(
        0,
        Math.round((inicio.getTime() - listo.getTime()) / 60000),
      ),
      parcial: esTercerizado(paso)
        ? false
        : est!.parcial || !!mejor.atencion?.parcial,
      equipoProduccionId: est?.equipo?.id ?? null,
      atencionPlanificada:
        mejor.atencion && paso.estado === 'pendiente'
          ? guardarAtencion(
              mejor.atencion,
              contextoDeAtencion(
                paso,
                estacionDe(paso),
                duracionDePaso(paso, medianas)!,
              ),
            )
          : undefined,
      reservasHumanas: mejor.atencion?.reservas ?? [],
      tramosOperacion: mejor.atencion?.tramos ?? [],
      faseEnCursoEstimada: paso.estado === 'en_curso',
      tercerizado: esTercerizado(paso),
      enCurso: paso.estado === 'en_curso',
      candidatos,
    });
    if (!esTercerizado(paso) && listo > ahora) {
      const lista = llegadasPorEstacion.get(est!.key) ?? [];
      lista.push({
        pasoId: paso.id,
        itemId: item.id,
        llegada: listo,
        duracionMin: duracion!,
      });
      llegadasPorEstacion.set(est!.key, lista);
    }
  }

  // Si quedó un nodo sin programar, depende de un camino sin duración o de
  // una referencia imposible. No se inventa fecha: se propaga "sin estimar".
  for (const pasoId of pendientes) {
    const nodo = pasoPorId.get(pasoId);
    if (nodo && !itemsSinVentana.has(nodo.item.id)) {
      resultadoDe(nodo.item).sinEstimar = true;
      if ((predecesores.get(pasoId) ?? []).some((id) => !programados.has(id)))
        resultadoDe(nodo.item).motivoSinEstimar ??=
          'La fecha depende de pasos previos que todavía no pudieron planificarse.';
    }
  }
  for (const item of items) {
    const resultado = porItem.get(item.id);
    if (!resultado || resultado.sinEstimar) continue;
    const terminalesDeclarados = item.pasos.filter((paso) => paso.esTerminal);
    const terminales =
      terminalesDeclarados.length > 0
        ? terminalesDeclarados
        : item.pasos.filter((paso) =>
            item.pasos.every(
              (otro) => !(predecesores.get(otro.id) ?? []).includes(paso.id),
            ),
          );
    const fechas = terminales
      .map((paso) => finTrabajo.get(liberacionTanda.get(paso.id) ?? paso.id))
      .filter((fecha): fecha is Date => fecha != null);
    if (fechas.length === terminales.length && fechas.length > 0) {
      resultado.finEstimado = fechas.reduce((max, fecha) =>
        fecha > max ? fecha : max,
      );
    }
  }

  return { porItem, llegadasPorEstacion, traza };
}

/**
 * El pool de la máquina que usa este paso, o null si no usa ninguna. La
 * máquina se identifica por (centro de costo + familia): el centro de costo
 * solo no basta porque varias máquinas físicas comparten uno (guillotina +
 * laminadora + plotter en la misma estación), y la familia las separa. El
 * pool tiene capacidad 1 y se crea la primera vez que un paso lo pide.
 */
function claveMaquina(_est: EstacionSim, paso: TableroPasoData): string | null {
  return paso.maquinaId ? `maquina:${paso.maquinaId}` : null;
}

function poolDeMaquina(
  est: EstacionSim,
  paso: TableroPasoData,
  ahora: Date,
): Date[] | null {
  const clave = claveMaquina(est, paso);
  if (!clave) return null;
  let pool = est.maquinas.get(clave);
  if (!pool) {
    pool = [new Date(ahora)];
    est.maquinas.set(clave, pool);
  }
  return pool;
}

/** Ocupa la máquina del paso, si usa alguna. */
function ocuparMaquina(
  est: EstacionSim,
  paso: TableroPasoData,
  fin: Date,
  ahora: Date,
) {
  const pool = poolDeMaquina(est, paso, ahora);
  if (!pool) return;
  let idx = 0;
  for (let i = 1; i < pool.length; i += 1) {
    if (pool[i] < pool[idx]) idx = i;
  }
  pool[idx] = fin;
}

/** Reemplaza el puesto que se libera antes por el nuevo fin. */
function ocupar(est: EstacionSim, fin: Date) {
  if (!est.servers) return;
  let idx = 0;
  for (let i = 1; i < est.servers.length; i += 1) {
    if (est.servers[i] < est.servers[idx]) idx = i;
  }
  est.servers[idx] = fin;
}

/**
 * Suma N días HÁBILES (lunes a viernes, no feriados) a una fecha: el
 * margen de seguridad del cotizador (D13). La hora se preserva. Con 0
 * devuelve la fecha tal cual.
 */
export function sumarDiasHabiles(
  fecha: Date,
  dias: number,
  noLaborables: Set<string> = new Set(),
  zona: string = ZONA_DEFAULT,
): Date {
  let restantes = Math.max(0, Math.floor(dias));
  if (restantes === 0) return new Date(fecha);

  // Se avanza sobre la FECHA de pared del taller y al final se reconstruye
  // el instante conservando la hora de pared original.
  const p = partesEnZona(fecha, zona);
  let clave = claveFechaEnZona(fecha, zona);
  let guardia = 0;
  while (restantes > 0 && guardia < 400) {
    guardia += 1;
    clave = sumarDiasAClave(clave, 1);
    const dow = diaSemanaDeClave(clave);
    if (dow === 'dom' || dow === 'sab') continue;
    if (noLaborables.has(clave)) continue;
    restantes -= 1;
  }
  const hora = `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}`;
  return instanteDe(clave, hora, zona);
}
