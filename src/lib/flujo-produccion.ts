/**
 * Simulación de flujo del taller (Fase 2b) — motor puro y determinista.
 *
 * Le pone TIEMPO a la carga en camino: programa los pasos restantes de
 * cada item contra las estaciones reales (calendario + puestos) con
 * list-scheduling de capacidad finita, y devuelve la fecha estimada de
 * fin por item y la hora estimada de llegada de cada paso futuro a su
 * estación. No es un scheduler óptimo: es una aproximación honesta para
 * ETAs operativas. Ver docs/simulacion-flujo-diseno.md
 */

import {
  calendarioDefault,
  DIAS_SEMANA,
  type CalendarioDia,
  type CalendarioEstacion,
  type Estacion,
} from "@/lib/estaciones";
import {
  prioridadDerivada,
  resolverEstacionDePaso,
  SIN_ESTACION_KEY,
  type TableroItemData,
  type TableroPasoData,
} from "@/lib/tablero-produccion";
import {
  claveFechaEnZona,
  diaSemanaDeClave,
  instanteDe,
  partesEnZona,
  sumarDiasAClave,
  ZONA_DEFAULT,
} from "@/lib/zona";

/** Horizonte de búsqueda de ventanas laborales (D8). */
const HORIZONTE_DIAS = 120;

/** Piso de minutos restantes de un paso en curso (D3). */
const MIN_RESTANTE_EN_CURSO = 5;

export type SimulacionItem = {
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
export const PROVEEDOR_KEY = "__proveedor__";

/**
 * Un paso ya colocado en el plan: el registro de UNA decisión del
 * scheduler. El motor calculaba todo esto y lo descartaba; anotarlo es
 * lo que permite mostrar la simulación en vez de sólo su resultado.
 */
export type PasoProgramado = {
  /** Orden en que el scheduler tomó la decisión — NO es cronológico. */
  orden: number;
  itemId: string;
  pasoId: string;
  pasoIndice: number;
  /** Dependencias reales resueltas por el scheduler. Pueden pertenecer a
   *  otro item de la misma OT (componente → etapa del producto padre). */
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
  let restante = minutos;
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
    const disponibles = (finVentana.getTime() - t.getTime()) / 60000;
    if (restante <= disponibles)
      return new Date(t.getTime() + restante * 60000);
    restante -= disponibles;
    t = avanzarAVentana(calendario, finVentana, noLaborables, zona);
  }
  return null;
}

// ── Motor ────────────────────────────────────────────────────────────────

type EstacionSim = {
  key: string;
  calendario: CalendarioEstacion;
  /** null = sin restricción de capacidad (bucket "sin estación", D5). */
  servers: Date[] | null;
  /** Corre con supuestos (calendario default o sin estación). */
  parcial: boolean;
  /**
   * Puestos NO son máquinas. Una estación puede tener 2 operarios y una sola
   * guillotina: dos pasos de guillotina no van en paralelo aunque sobren
   * puestos, pero guillotina + laminado sí. Un paso ocupa SU máquina y UN
   * puesto a la vez.
   *
   * La máquina se identifica por (centro de costo + familia): el centro de
   * costo solo no alcanza porque en un taller real varias máquinas físicas
   * distintas comparten un mismo centro (guillotina + laminadora + plotter en
   * "Corte y terminación"), y la familia es lo que las separa. Capacidad 1
   * por clave: si hay dos guillotinas, se modelan con centros distintos.
   *
   * Los pools se crean bajo demanda (no se conoce la familia de una máquina
   * desde su ficha, sólo su centro de costo).
   */
  maquinas: Map<string, Date[]>;
  /** Centros de costo que TIENEN máquina acá: un paso es máquina-dependiente
   *  sólo si su centro de costo cae en este conjunto. */
  ccsConMaquina: Set<string>;
  /** Minutos de traslado/preparación antes de poder empezar acá. */
  preparacionMin: number;
};

/**
 * Un paso tercerizado no se produce acá: lo hace un proveedor, en su propio
 * calendario y sin ocupar un puesto del taller. Su costo en tiempo es el lead
 * time (`plazoProveedorDias`), no minutos de estación.
 */
function esTercerizado(paso: TableroPasoData): boolean {
  return paso.tipoEjecucion === "tercerizado";
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
  estaciones,
  medianas,
  ahora = new Date(),
  noLaborables = new Set<string>(),
  tiempoEntrePasosMin = 0,
  zona = ZONA_DEFAULT,
}: {
  items: TableroItemData[];
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
  const porItem = new Map<string, SimulacionItem>();
  const llegadasPorEstacion = new Map<string, LlegadaEstacion[]>();
  const traza: PasoProgramado[] = [];
  const anotar = (p: Omit<PasoProgramado, "orden">) =>
    traza.push({ orden: traza.length, ...p });

  // Estaciones simulables: las activas, con calendario default si falta (D5).
  const registros = new Map<string, EstacionSim>();
  for (const estacion of estaciones) {
    if (!estacion.activo) continue;
    const sinCalendario = calendarioVacio(estacion.calendario);
    const ccsConMaquina = new Set<string>();
    for (const maquina of estacion.maquinas) {
      if (maquina.centroCostoId) ccsConMaquina.add(maquina.centroCostoId);
    }
    registros.set(estacion.id, {
      key: estacion.id,
      calendario: sinCalendario
        ? calendarioDefault()
        : (estacion.calendario as CalendarioEstacion),
      servers: Array.from(
        { length: Math.max(1, estacion.capacidadConcurrente) },
        () => new Date(ahora),
      ),
      parcial: sinCalendario,
      maquinas: new Map(),
      ccsConMaquina,
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
    maquinas: new Map(),
    ccsConMaquina: new Set(),
    preparacionMin: Math.max(0, tiempoEntrePasosMin),
  };

  const estacionDe = (paso: TableroPasoData): EstacionSim => {
    const resuelta = resolverEstacionDePaso(estaciones, paso);
    return (resuelta && registros.get(resuelta.id)) || sinEstacion;
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

  const resultadoDe = (item: TableroItemData) => {
    let resultado = porItem.get(item.id);
    if (!resultado) {
      resultado = {
        finEstimado: null,
        sinEstimar: false,
        parcial: false,
        asumeDesbloqueo: item.pasos.some((paso) => paso.estado === "bloqueado"),
      };
      porItem.set(item.id, resultado);
    }
    return resultado;
  };
  for (const item of items) {
    if (!item.sinRuta && item.pasos.some((paso) => paso.estado !== "hecho"))
      resultadoDe(item);
  }

  const programados = new Set<string>();
  const finTrabajo = new Map<string, Date>();
  const disponibleDesde = new Map<string, Date>();
  for (const { paso } of pasoPorId.values()) {
    if (paso.estado !== "hecho") continue;
    programados.add(paso.id);
    finTrabajo.set(paso.id, new Date(ahora));
    disponibleDesde.set(paso.id, new Date(ahora));
  }

  const pendientes = new Set(
    [...pasoPorId.values()]
      .filter(({ paso }) => paso.estado !== "hecho")
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
  };
  const esMejor = (a: Candidato, b: Candidato) => {
    if (a.inicio.getTime() !== b.inicio.getTime()) return a.inicio < b.inicio;
    // Si dos trabajos disputan el mismo hueco, atiende primero al que lleva
    // más tiempo listo. Evita que una rama recién liberada se adelante a una
    // OT que ya esperaba por ese puesto.
    if (a.listo.getTime() !== b.listo.getTime()) return a.listo < b.listo;
    const urgenteA = prioridadDerivada(a.item.fechaEntrega) === "urgent";
    const urgenteB = prioridadDerivada(b.item.fechaEntrega) === "urgent";
    if (urgenteA !== urgenteB) return urgenteA;
    const entregaA = a.item.fechaEntrega
      ? new Date(a.item.fechaEntrega).getTime()
      : Number.POSITIVE_INFINITY;
    const entregaB = b.item.fechaEntrega
      ? new Date(b.item.fechaEntrega).getTime()
      : Number.POSITIVE_INFINITY;
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

    for (const pasoId of pendientes) {
      const nodo = pasoPorId.get(pasoId)!;
      if (
        itemsSinEstimacion.has(nodo.item.id) ||
        itemsSinVentana.has(nodo.item.id)
      )
        continue;
      const previos = predecesores.get(pasoId) ?? [];
      if (!previos.every((id) => programados.has(id))) continue;
      const listo = previos.reduce((max, id) => {
        const fecha = disponibleDesde.get(id) ?? ahora;
        return fecha > max ? fecha : max;
      }, new Date(ahora));

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
      const est = estacionDe(nodo.paso);
      const enCurso = nodo.paso.estado === "en_curso";
      const transcurrido =
        enCurso && nodo.paso.iniciadoEl
          ? Math.max(
              0,
              (ahora.getTime() - new Date(nodo.paso.iniciadoEl).getTime()) /
                60000,
            )
          : 0;
      const duracion = enCurso
        ? Math.max(duracionBase - transcurrido, MIN_RESTANTE_EN_CURSO)
        : duracionBase;
      const libreDesde = est.servers
        ? est.servers.reduce(
            (min, fecha) => (fecha < min ? fecha : min),
            est.servers[0],
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
      const inicio = avanzarAVentana(
        est.calendario,
        inicioCrudo,
        noLaborables,
        zona,
      );
      if (!inicio) {
        // La duración es conocida: no es "sin estimar". Simplemente no hay
        // ninguna ventana laboral dentro del horizonte configurado.
        itemsSinVentana.add(nodo.item.id);
        marcoSinEstimacion = true;
        continue;
      }
      const candidato: Candidato = { ...nodo, listo, inicio, est, duracion };
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
      fin = sumarMinutosLaborales(
        est!.calendario,
        inicio,
        duracion!,
        noLaborables,
        zona,
      )!;
      preparacionMin = est!.preparacionMin;
      finSeparado =
        preparacionMin > 0
          ? (sumarMinutosLaborales(
              est!.calendario,
              fin,
              preparacionMin,
              noLaborables,
              zona,
            ) ?? fin)
          : fin;
      ocupar(est!, finSeparado);
      ocuparMaquina(est!, paso, finSeparado, ahora);
      if (est!.parcial) resultadoDe(item).parcial = true;
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
      parcial: esTercerizado(paso) ? false : est!.parcial,
      tercerizado: esTercerizado(paso),
      enCurso: paso.estado === "en_curso",
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
    if (nodo && !itemsSinVentana.has(nodo.item.id))
      resultadoDe(nodo.item).sinEstimar = true;
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
      .map((paso) => finTrabajo.get(paso.id))
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
function poolDeMaquina(
  est: EstacionSim,
  paso: TableroPasoData,
  ahora: Date,
): Date[] | null {
  const cc = paso.centroCostoId;
  if (!cc || !est.ccsConMaquina.has(cc)) return null;
  const clave = `${cc}::${paso.familiaCodigo}`;
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

// ── Fase 3: demora sugerida para trabajo NUEVO (cotizador) ───────────────

export type PasoHipotetico = {
  familiaCodigo: string;
  centroCostoId: string | null;
  duracionMin: number | null;
  nombre?: string;
  /** Paso comprado a un proveedor: no ocupa el taller, tarda su lead time. */
  tercerizado?: boolean;
  plazoProveedorDias?: number | null;
};

export type ItemHipotetico = {
  /** Id local del item en la ficha (clave del resultado). */
  id: string;
  pasos: PasoHipotetico[];
};

/**
 * "Si este trabajo entra AHORA, ¿cuándo sale?": corre la simulación con la
 * carga actual del taller MÁS los items hipotéticos del cotizador. Lo nuevo
 * compite sin urgencia y sin entrega: pierde todos los empates contra el
 * trabajo ya comprometido (promesa conservadora, D9 del doc). Devuelve la
 * estimación de los hipotéticos, por id.
 */
export function estimarDemoraNuevos({
  nuevos,
  enCola,
  estaciones,
  medianas,
  ahora = new Date(),
  noLaborables = new Set<string>(),
  zona = ZONA_DEFAULT,
}: {
  nuevos: ItemHipotetico[];
  /** Items vivos del tablero (las colas reales de hoy). */
  enCola: TableroItemData[];
  estaciones: Estacion[];
  medianas: Map<string, number>;
  ahora?: Date;
  noLaborables?: Set<string>;
  zona?: string;
}): Map<string, SimulacionItem> {
  const hipoteticos: TableroItemData[] = nuevos
    .filter((nuevo) => nuevo.pasos.length > 0)
    .map((nuevo) => ({
      id: nuevo.id,
      ordenId: `hipotetica-${nuevo.id}`,
      // "￿" ordena después de cualquier número real de OT: último
      // desempate perdido también contra items sin entrega.
      ordenNumero: `￿${nuevo.id}`,
      ordenEstado: "produccion",
      itemIndice: 1,
      codigo: nuevo.id,
      nombre: nuevo.id,
      clienteNombre: "",
      vendedorNombre: "",
      cantidad: 1,
      cantidadUnidad: "u",
      specs: [],
      fechaEntrega: null,
      archivosCount: 0,
      sinRuta: false,
      pasos: nuevo.pasos.map((paso, indice) => ({
        id: `${nuevo.id}-paso-${indice}`,
        indice,
        rutaPasoId: null,
        nombre: paso.nombre ?? paso.familiaCodigo,
        familiaCodigo: paso.familiaCodigo,
        categoriaFamilia: "",
        centroCostoId: paso.centroCostoId,
        centroCostoNombre: null,
        duracionEstimadaMin: paso.duracionMin,
        estado: "pendiente",
        motivoBloqueo: null,
        iniciadoEl: null,
        completadoEl: null,
        modoRegistro: "cronometro",
        tiempoRealMin: null,
        tiempoFuente: null,
        iniciadoPorNombre: null,
        completadoPorNombre: null,
        tramoAbierto: null,
        motivoPausa: null,
        tiempoAcumuladoMin: 0,
        mesaEsMia: false,
        mesaUsuarioNombre: null,
        tipoEjecucion: paso.tercerizado ? "tercerizado" : "interno",
        proveedorNombre: null,
        plazoProveedorDias: paso.plazoProveedorDias ?? null,
        estadoCompra: null,
      })),
    }));

  const { porItem } = simularFlujo({
    items: [...enCola, ...hipoteticos],
    estaciones,
    medianas,
    ahora,
    noLaborables,
    zona,
  });
  const resultado = new Map<string, SimulacionItem>();
  for (const nuevo of nuevos) {
    const eta = porItem.get(nuevo.id);
    if (eta) resultado.set(nuevo.id, eta);
  }
  return resultado;
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
    if (dow === "dom" || dow === "sab") continue;
    if (noLaborables.has(clave)) continue;
    restantes -= 1;
  }
  const hora = `${String(p.hh).padStart(2, "0")}:${String(p.mm).padStart(2, "0")}`;
  return instanteDe(clave, hora, zona);
}

// ── Etiquetas ────────────────────────────────────────────────────────────

const DIA_CORTO = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** "hoy 16:30" · "mañana 11:00" · "mar 22/07" · "22/08". */
export function etiquetaEta(fecha: Date, ahora: Date = new Date()): string {
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const dia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const dias = Math.round((dia.getTime() - hoy.getTime()) / 86400000);
  const hora = `${fecha.getHours()}:${String(fecha.getMinutes()).padStart(2, "0")}`;
  const corta = `${fecha.getDate()}/${String(fecha.getMonth() + 1).padStart(2, "0")}`;
  if (dias <= 0) return `hoy ${hora}`;
  if (dias === 1) return `mañana ${hora}`;
  if (dias < 7) return `${DIA_CORTO[fecha.getDay()]} ${corta}`;
  return corta;
}
