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
  type DiaSemana,
  type Estacion,
} from "@/lib/estaciones";
import {
  pasoActivo,
  prioridadDerivada,
  resolverEstacionDePaso,
  SIN_ESTACION_KEY,
  type TableroItemData,
  type TableroPasoData,
} from "@/lib/tablero-produccion";

/** Índice Date.getDay() (0 = domingo) → clave del calendario. */
const JS_DIA: DiaSemana[] = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

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

function minutosDe(hora: string) {
  const [hh, mm] = hora.split(":").map(Number);
  return hh * 60 + mm;
}

function claveFecha(fecha: Date) {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function franjasDelDia(
  calendario: CalendarioEstacion,
  fecha: Date,
  noLaborables: Set<string>,
): CalendarioDia {
  if (noLaborables.has(claveFecha(fecha))) return [];
  return calendario.dias[JS_DIA[fecha.getDay()]] ?? [];
}

function conHora(fecha: Date, minutos: number) {
  const resultado = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  resultado.setMinutes(minutos);
  return resultado;
}

/**
 * Avanza `t` al próximo instante laboral (t mismo si ya cae dentro de una
 * franja del día — puede haber varias: jornada cortada). null si no hay
 * ventana en el horizonte (D8).
 */
export function avanzarAVentana(
  calendario: CalendarioEstacion,
  t: Date,
  noLaborables: Set<string> = new Set(),
): Date | null {
  for (let i = 0; i < HORIZONTE_DIAS; i += 1) {
    const dia = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i);
    for (const franja of franjasDelDia(calendario, dia, noLaborables)) {
      const inicio = conHora(dia, minutosDe(franja.desde));
      const fin = conHora(dia, minutosDe(franja.hasta));
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
): Date | null {
  for (const franja of franjasDelDia(calendario, t, noLaborables)) {
    const inicio = conHora(t, minutosDe(franja.desde));
    const fin = conHora(t, minutosDe(franja.hasta));
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
): Date | null {
  let t = avanzarAVentana(calendario, desde, noLaborables);
  let restante = minutos;
  // Antes la guardia contaba días; con jornada cortada hay más de una
  // iteración por día (una por franja).
  let guardia = 0;
  const limite = (HORIZONTE_DIAS + 7) * 6;
  while (t && guardia < limite) {
    guardia += 1;
    const finVentana = finDeFranjaActual(calendario, t, noLaborables);
    if (!finVentana) {
      t = avanzarAVentana(calendario, t, noLaborables);
      continue;
    }
    const disponibles = (finVentana.getTime() - t.getTime()) / 60000;
    if (restante <= disponibles) return new Date(t.getTime() + restante * 60000);
    restante -= disponibles;
    t = avanzarAVentana(calendario, finVentana, noLaborables);
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

type ItemSim = {
  data: TableroItemData;
  restantes: TableroPasoData[];
  idx: number;
  readyAt: Date;
  resultado: SimulacionItem;
  urgente: boolean;
  entregaTs: number | null;
  done: boolean;
};

/**
 * Un paso tercerizado no se produce acá: lo hace un proveedor, en su propio
 * calendario y sin ocupar un puesto del taller. Su costo en tiempo es el lead
 * time (`plazoProveedorDias`), no minutos de estación.
 */
function esTercerizado(paso: TableroPasoData): boolean {
  return paso.tipoEjecucion === "tercerizado";
}

function duracionDePaso(paso: TableroPasoData, medianas: Map<string, number>): number | null {
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
}: {
  items: TableroItemData[];
  estaciones: Estacion[];
  medianas: Map<string, number>;
  ahora?: Date;
  noLaborables?: Set<string>;
  /** Default del tenant para las estaciones que no declaran el suyo. */
  tiempoEntrePasosMin?: number;
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
      calendario: sinCalendario ? calendarioDefault() : (estacion.calendario as CalendarioEstacion),
      servers: Array.from({ length: Math.max(1, estacion.capacidadConcurrente) }, () => new Date(ahora)),
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

  // Estado inicial por item; los en curso ocupan su puesto YA (D3).
  const sims: ItemSim[] = [];
  for (const item of items) {
    if (item.sinRuta) continue;
    const restantes = [...item.pasos]
      .filter((paso) => paso.estado !== "hecho")
      .sort((a, b) => a.indice - b.indice);
    if (restantes.length === 0) continue;

    const sim: ItemSim = {
      data: item,
      restantes,
      idx: 0,
      readyAt: new Date(ahora),
      resultado: { finEstimado: null, sinEstimar: false, parcial: false, asumeDesbloqueo: false },
      urgente: prioridadDerivada(item.fechaEntrega) === "urgent",
      entregaTs: item.fechaEntrega ? new Date(item.fechaEntrega).getTime() : null,
      done: false,
    };
    porItem.set(item.id, sim.resultado);

    const frontera = restantes[0];
    if (frontera.estado === "bloqueado") sim.resultado.asumeDesbloqueo = true;
    if (frontera.estado === "en_curso") {
      const est = estacionDe(frontera);
      const duracion = duracionDePaso(frontera, medianas);
      if (duracion == null) {
        sim.resultado.sinEstimar = true;
        sim.done = true;
      } else {
        const transcurrido = frontera.iniciadoEl
          ? Math.max(0, (ahora.getTime() - new Date(frontera.iniciadoEl).getTime()) / 60000)
          : 0;
        const restanteMin = Math.max(duracion - transcurrido, MIN_RESTANTE_EN_CURSO);
        const fin = sumarMinutosLaborales(est.calendario, ahora, restanteMin, noLaborables);
        if (fin === null) {
          sim.done = true;
        } else {
          ocupar(est, fin);
          if (est.parcial) sim.resultado.parcial = true;
          anotar({
            itemId: item.id,
            pasoId: frontera.id,
            pasoIndice: frontera.indice,
            estacionKey: est.key,
            inicio: new Date(ahora),
            fin,
            duracionMin: restanteMin,
            // Ya está en curso: el material llegó hace rato.
            preparacionMin: 0,
            plazoDias: null,
            esperaMin: 0,
            parcial: est.parcial,
            tercerizado: false,
            enCurso: true,
            candidatos: null,
          });
          sim.readyAt = fin;
          sim.idx = 1;
          if (sim.idx === restantes.length) {
            sim.resultado.finEstimado = fin;
            sim.done = true;
          }
        }
      }
    }
    sims.push(sim);
  }

  // List-scheduling (D2): siempre el candidato que puede arrancar antes;
  // empates por urgencia > entrega más próxima > orden de emisión.
  let guardia = 0;
  const limite = sims.reduce((acc, sim) => acc + sim.restantes.length, 0) + 8;
  while (guardia < limite) {
    guardia += 1;

    // Los tercerizados se resuelven ANTES de repartir capacidad: no compiten
    // por un puesto (el proveedor trabaja en paralelo al taller), sólo corren
    // el reloj del item y liberan al paso siguiente. Se drenan en cadena por
    // si la ruta tiene dos seguidos.
    for (const sim of sims) {
      while (
        !sim.done &&
        sim.idx < sim.restantes.length &&
        esTercerizado(sim.restantes[sim.idx])
      ) {
        const paso = sim.restantes[sim.idx];
        const plazo = paso.plazoProveedorDias;
        if (plazo == null || plazo < 0) {
          // Sin lead time cargado no hay con qué estimar. Igual que cualquier
          // paso sin duración (D6): no se inventa una ETA.
          sim.resultado.sinEstimar = true;
          sim.done = true;
          break;
        }
        const fin = sumarDiasHabiles(sim.readyAt, plazo, noLaborables);
        anotar({
          itemId: sim.data.id,
          pasoId: paso.id,
          pasoIndice: paso.indice,
          estacionKey: PROVEEDOR_KEY,
          inicio: new Date(sim.readyAt),
          fin,
          duracionMin: null,
          // Lo hace el proveedor: no hay traslado interno que modelar.
          preparacionMin: 0,
          plazoDias: plazo,
          esperaMin: 0,
          parcial: false,
          tercerizado: true,
          enCurso: false,
          candidatos: null,
        });
        sim.readyAt = fin;
        sim.idx += 1;
        if (sim.idx === sim.restantes.length) {
          sim.resultado.finEstimado = fin;
          sim.done = true;
        }
      }
    }

    let mejor: { sim: ItemSim; est: EstacionSim; duracion: number; start: Date } | null = null;
    /* Cuántos trabajos competían por un puesto en este turno: es el "por
       qué" de la decisión, no una métrica de performance. */
    let candidatos = 0;

    for (const sim of sims) {
      if (sim.done || sim.idx >= sim.restantes.length) continue;
      const paso = sim.restantes[sim.idx];
      const duracion = duracionDePaso(paso, medianas);
      if (duracion == null) {
        sim.resultado.sinEstimar = true;
        sim.done = true;
        continue;
      }
      const est = estacionDe(paso);
      /* Hay que esperar a que se liberen los DOS recursos: el puesto y la
         máquina. Cada uno ya viene con la separación del ocupante anterior
         incorporada (se libera prep minutos después de terminar), así que
         entre dos pasos del mismo recurso queda un hueco visible. */
      const libreDesde = est.servers
        ? est.servers.reduce((min, s) => (s < min ? s : min), est.servers[0])
        : sim.readyAt;
      const pool = poolDeMaquina(est, paso, ahora);
      const maquinaLibre = pool
        ? pool.reduce((min, s) => (s < min ? s : min), pool[0])
        : null;
      let startRaw = libreDesde > sim.readyAt ? libreDesde : sim.readyAt;
      if (maquinaLibre && maquinaLibre > startRaw) startRaw = maquinaLibre;
      const start = avanzarAVentana(est.calendario, startRaw, noLaborables);
      if (start === null) {
        sim.done = true;
        continue;
      }
      const candidato = { sim, est, duracion, start };
      candidatos += 1;
      if (!mejor || antesQue(candidato, mejor)) mejor = candidato;
    }
    if (!mejor) break;

    const { sim, est, duracion, start } = mejor;
    const paso = sim.restantes[sim.idx];
    const prep = est.preparacionMin;
    const fin = sumarMinutosLaborales(est.calendario, start, duracion, noLaborables);
    if (fin === null) {
      sim.done = true;
      continue;
    }
    /* La separación entre pasos es un hueco DESPUÉS del trabajo: cambio de
       material, traslado, el operario que no arranca lo siguiente en el mismo
       instante. Se aplica liberando el puesto, la máquina y el item `prep`
       minutos más tarde que el fin, así que el próximo paso de ese recurso
       arranca con un hueco visible. El bloque que se dibuja es sólo el
       trabajo (start → fin); la separación queda como aire entre bloques. */
    const finSeparado =
      prep > 0
        ? (sumarMinutosLaborales(est.calendario, fin, prep, noLaborables) ?? fin)
        : fin;
    ocupar(est, finSeparado);
    ocuparMaquina(est, paso, finSeparado, ahora);
    if (est.parcial) sim.resultado.parcial = true;
    anotar({
      itemId: sim.data.id,
      pasoId: paso.id,
      pasoIndice: paso.indice,
      estacionKey: est.key,
      inicio: start,
      fin,
      duracionMin: duracion,
      preparacionMin: prep,
      plazoDias: null,
      // El trabajo estaba listo en readyAt; si arrancó después, esperó puesto
      // o máquina.
      esperaMin: Math.max(
        0,
        Math.round((start.getTime() - sim.readyAt.getTime()) / 60000),
      ),
      parcial: est.parcial,
      tercerizado: false,
      enCurso: false,
      candidatos,
    });
    // Llegada = cuando el paso queda listo (no cuando arranca): los pasos
    // que NO son la frontera actual son la "carga en camino" con timing.
    if (sim.idx > 0 || !pasoActivo(sim.data, paso)) {
      const lista = llegadasPorEstacion.get(est.key) ?? [];
      lista.push({ pasoId: paso.id, itemId: sim.data.id, llegada: sim.readyAt, duracionMin: duracion });
      llegadasPorEstacion.set(est.key, lista);
    }
    // El item queda libre para su próximo paso `prep` después (traslado),
    // pero su ETA es el fin del trabajo real, no incluye la separación final.
    sim.readyAt = finSeparado;
    sim.idx += 1;
    if (sim.idx === sim.restantes.length) {
      sim.resultado.finEstimado = fin;
      sim.done = true;
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

function antesQue(
  a: { sim: ItemSim; start: Date },
  b: { sim: ItemSim; start: Date },
): boolean {
  if (a.start.getTime() !== b.start.getTime()) return a.start < b.start;
  if (a.sim.urgente !== b.sim.urgente) return a.sim.urgente;
  const entregaA = a.sim.entregaTs ?? Number.POSITIVE_INFINITY;
  const entregaB = b.sim.entregaTs ?? Number.POSITIVE_INFINITY;
  if (entregaA !== entregaB) return entregaA < entregaB;
  // FIFO real: el que ESPERA en la estación desde antes va primero.
  if (a.sim.readyAt.getTime() !== b.sim.readyAt.getTime()) return a.sim.readyAt < b.sim.readyAt;
  return a.sim.data.ordenNumero < b.sim.data.ordenNumero;
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
}: {
  nuevos: ItemHipotetico[];
  /** Items vivos del tablero (las colas reales de hoy). */
  enCola: TableroItemData[];
  estaciones: Estacion[];
  medianas: Map<string, number>;
  ahora?: Date;
  noLaborables?: Set<string>;
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
): Date {
  const resultado = new Date(fecha);
  let restantes = Math.max(0, Math.floor(dias));
  let guardia = 0;
  while (restantes > 0 && guardia < 400) {
    guardia += 1;
    resultado.setDate(resultado.getDate() + 1);
    const dow = resultado.getDay();
    if (dow === 0 || dow === 6) continue;
    if (noLaborables.has(claveFecha(resultado))) continue;
    restantes -= 1;
  }
  return resultado;
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
