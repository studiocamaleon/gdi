import { programarFasePersonal } from './capacidad-personal';
import { recortarDemanda, type DemandaHumana } from './demanda-humana';
import type {
  CalendarioEstacion,
  EquipoProduccion,
  PersonaProduccion,
} from './estaciones-tipos';
export type ReservaHumana = {
  inicio: number;
  fin: number;
  personas: number;
  pasoId?: string;
  empleadoIds?: string[];
};
export type PlanAtencion = {
  inicio: Date;
  fin: Date;
  finOcupacion: Date;
  reservas: ReservaHumana[];
  tramos: TramoOperacion[];
  parcial: boolean;
};
/** Trabajo efectivo de la operación; las esperas y la separación no son RUN. */
export type TramoOperacion = {
  inicio: number;
  fin: number;
  personas: number;
  tipo: 'operario' | 'maquina' | 'maquina_atendida' | 'sin_verificar';
};
type Proyectar = (
  calendario: CalendarioEstacion,
  desde: Date,
  minutos: number,
) => Array<{ inicio: number; fin: number }> | null;

/** Misma disponibilidad: la máquina y el equipo deben estar presentes. */
export function intersectarCalendarios(
  a: CalendarioEstacion,
  b: CalendarioEstacion,
): CalendarioEstacion {
  const dias = Object.fromEntries(
    Object.entries(a.dias).map(([dia, franjas]) => {
      const comunes = (franjas ?? []).flatMap((f) =>
        (b.dias[dia as keyof typeof b.dias] ?? []).flatMap((g) => {
          const desde = f.desde > g.desde ? f.desde : g.desde,
            hasta = f.hasta < g.hasta ? f.hasta : g.hasta;
          return desde < hasta ? [{ desde, hasta }] : [];
        }),
      );
      return [dia, comunes.length ? comunes : null];
    }),
  ) as CalendarioEstacion['dias'];
  return { dias };
}

/** Capacidad ponderada: una colocación de dos personas consume dos cupos. */
export function finConflictoHumano(
  inicio: number,
  fin: number,
  personas: number,
  capacidad: number,
  reservas: ReservaHumana[],
): number | null {
  if (personas === 0 || fin <= inicio) return null;
  const solapadas = reservas.filter(
    (r) => r.inicio < fin && r.fin > inicio && r.personas > 0,
  );
  const puntos = [
    ...new Set([
      inicio,
      ...solapadas
        .flatMap((r) => [r.inicio, r.fin])
        .filter((t) => t >= inicio && t < fin),
    ]),
  ].sort((a, b) => a - b);
  for (const t of puntos) {
    const activas = solapadas.filter((r) => r.inicio <= t && r.fin > t);
    if (personas + activas.reduce((n, r) => n + r.personas, 0) > capacidad)
      return activas.length ? Math.min(...activas.map((r) => r.fin)) : Infinity;
  }
  return null;
}

/** Las fases conservan los minutos cotizados. Una espera para descargar
 * prolonga la ocupación de la máquina, sin inventar minutos de trabajo. */
export function programarAtencion(args: {
  desde: Date;
  demanda: DemandaHumana;
  calendario: CalendarioEstacion;
  equipo?: EquipoProduccion | null;
  empleados?: PersonaProduccion[];
  reservas: ReservaHumana[];
  preparacionMin: number;
  proyectar: Proyectar;
}): PlanAtencion | null {
  const { demanda, calendario, proyectar } = args;
  const equipo = args.empleados === undefined ? args.equipo : null;
  const empleados = args.empleados?.map((e) => ({
    ...e,
    calendario: e.calendario
      ? intersectarCalendarios(calendario, e.calendario)
      : null,
  }));
  const requiereEquipo =
    demanda.fases.some((f) => f.personas > 0) || args.preparacionMin > 0;
  if (
    equipo &&
    requiereEquipo &&
    (!equipo.activo ||
      !equipo.calendario ||
      !Number.isInteger(equipo.personas) ||
      equipo.personas < 1)
  )
    return null;
  const combinado = equipo?.calendario
    ? intersectarCalendarios(calendario, equipo.calendario)
    : calendario;
  let t = args.desde,
    inicio: Date | null = null,
    fin = args.desde;
  const reservas: ReservaHumana[] = [];
  const trabajo: TramoOperacion[] = [];
  const fases = [
    ...demanda.fases,
    { minutos: args.preparacionMin, personas: 1 },
  ];
  for (let indice = 0; indice < fases.length; indice++) {
    const fase = fases[indice];
    if (fase.minutos <= 0) continue;
    if (equipo && fase.personas > equipo.personas) return null;
    let colocada = false;
    for (let intento = 0; intento <= args.reservas.length + 2; intento++) {
      const personales =
        empleados !== undefined && fase.personas > 0
          ? programarFasePersonal({
              desde: t,
              minutos: fase.minutos,
              personas: fase.personas,
              empleados,
              reservas: args.reservas,
              proyectar,
            })
          : undefined;
      const tramos =
        personales !== undefined
          ? personales
          : proyectar(
              fase.personas > 0 ? combinado : calendario,
              t,
              fase.minutos,
            );
      if (!tramos?.length) return null;
      const conflicto =
        equipo && fase.personas > 0
          ? tramos
              .map((r) =>
                finConflictoHumano(
                  r.inicio,
                  r.fin,
                  fase.personas,
                  equipo.personas,
                  args.reservas,
                ),
              )
              .find((c) => c != null)
          : null;
      if (conflicto != null) {
        if (!Number.isFinite(conflicto) || conflicto <= t.getTime())
          return null;
        t = new Date(conflicto);
        continue;
      }
      inicio ??= new Date(tramos[0].inicio);
      t = new Date(tramos[tramos.length - 1].fin);
      if (indice < demanda.fases.length) fin = t;
      if (indice < demanda.fases.length)
        trabajo.push(
          ...tramos.map((r) => ({
            ...r,
            personas: fase.personas,
            tipo: !demanda.verificada
              ? ('sin_verificar' as const)
              : fase.personas > 0
                ? fase.operacionMaquina
                  ? ('maquina_atendida' as const)
                  : ('operario' as const)
                : ('maquina' as const),
          })),
        );
      if ((equipo || empleados !== undefined) && fase.personas > 0)
        reservas.push(
          ...tramos.map((r) => ({ ...r, personas: fase.personas })),
        );
      colocada = true;
      break;
    }
    if (!colocada) return null;
  }
  return {
    inicio: inicio ?? args.desde,
    fin,
    finOcupacion: t,
    reservas,
    tramos: trabajo,
    parcial:
      !demanda.verificada ||
      (requiereEquipo && !equipo && empleados === undefined) ||
      !!empleados?.some((e) => e.activo !== false && !e.calendario),
  };
}

/** Avance proyectado dentro de los tramos registrados. Pausas, noches y
 * cierres no consumen la cotización. La fase se estima; no es telemetría. */
export function demandaPendiente(args: {
  demanda: DemandaHumana;
  ejecucion: Array<{ inicio: string; fin: string | null }>;
  ahora: Date;
  calendario: CalendarioEstacion;
  equipo?: EquipoProduccion | null;
  empleados?: PersonaProduccion[];
  proyectar: Proyectar;
}): DemandaHumana {
  let pendiente = args.demanda;
  let ultimoFin = -Infinity;
  const intervalos = args.ejecucion
    .map((r) => ({
      inicio: new Date(r.inicio).getTime(),
      fin: r.fin
        ? Math.min(args.ahora.getTime(), new Date(r.fin).getTime())
        : args.ahora.getTime(),
    }))
    .filter(
      (r) =>
        Number.isFinite(r.inicio) && Number.isFinite(r.fin) && r.fin > r.inicio,
    )
    .sort((a, b) => a.inicio - b.inicio);
  for (const intervalo of intervalos) {
    const inicio = Math.max(intervalo.inicio, ultimoFin);
    ultimoFin = Math.max(ultimoFin, intervalo.fin);
    if (inicio >= intervalo.fin) continue;
    const plan = programarAtencion({
      ...args,
      desde: new Date(inicio),
      demanda: pendiente,
      reservas: [],
      preparacionMin: 0,
    });
    if (!plan) return { ...pendiente, verificada: false };
    const consumido = plan.tramos.reduce(
      (s, r) =>
        s + Math.max(0, Math.min(r.fin, intervalo.fin) - r.inicio) / 60000,
      0,
    );
    const total = pendiente.fases.reduce((s, f) => s + f.minutos, 0);
    pendiente = recortarDemanda(
      pendiente,
      total,
      Math.max(0, total - consumido),
    );
  }
  return pendiente;
}
