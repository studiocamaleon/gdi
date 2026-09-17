import type { CalendarioEstacion, PersonaProduccion } from './estaciones-tipos';
import type { ReservaHumana } from './capacidad-humana';
import { milisegundosDeMinutos } from './demanda-humana';

type Ventana = { inicio: number; fin: number };
type Proyectar = (
  c: CalendarioEstacion,
  d: Date,
  m: number,
) => Ventana[] | null;

type ParametrosPersonal = {
  desde: Date;
  minutos: number;
  personas: number;
  empleados: PersonaProduccion[];
  obligatorioId?: string;
  preferidoId?: string;
  preferidosIds?: string[];
  reservas: ReservaHumana[];
  proyectar: Proyectar;
};

/** Elige una dotación completa en la primera ventana común, equilibrando carga.
 * Sólo consulta disponibilidad: no consume ni publica una reserva. */
export function seleccionarDotacionPersonal(
  args: Omit<ParametrosPersonal, 'minutos'>,
): string[] | null {
  return (
    programarPersonal({ ...args, minutos: 480 }, true)?.[0]?.empleadoIds ?? null
  );
}

/** Reserva la dotación de una fase. El plan del paso fija sus integrantes;
 * la reconstrucción histórica puede conservar los relevos ya registrados. */
export function programarFasePersonal(args: ParametrosPersonal) {
  return programarPersonal(args);
}

function programarPersonal(
  args: ParametrosPersonal,
  soloSeleccion = false,
): Array<Ventana & { empleadoIds: string[] }> | null {
  const empleados = [
    ...new Map(
      args.empleados
        .filter((e) => e.activo !== false && e.calendario)
        .map((e) => [e.id, e]),
    ).values(),
  ].sort((a, b) => a.id.localeCompare(b.id));
  if (
    !Number.isInteger(args.personas) ||
    args.personas < 1 ||
    empleados.length < args.personas ||
    (args.obligatorioId !== undefined &&
      !empleados.some((e) => e.id === args.obligatorioId))
  )
    return null;
  // Descarta horarios semanales sin ninguna coincidencia de la dotación.
  const coincide = Object.keys(empleados[0].calendario!.dias).some((dia) => {
    const franjas = empleados.flatMap((e) =>
      (e.calendario!.dias[dia as keyof CalendarioEstacion['dias']] ?? []).map(
        (f) => ({ ...f, id: e.id }),
      ),
    );
    return franjas.some(
      (f) =>
        new Set(
          franjas
            .filter((g) => g.desde <= f.desde && g.hasta > f.desde)
            .map((g) => g.id),
        ).size >= args.personas,
    );
  });
  if (!coincide) return null;
  // Minutos-persona ya comprometidos, compartidos entre todas las estaciones.
  const carga = new Map<string, number>();
  for (const r of args.reservas)
    for (const id of new Set(r.empleadoIds ?? []))
      carga.set(id, (carga.get(id) ?? 0) + Math.max(0, r.fin - r.inicio));
  // Date y las ventanas usan milisegundos enteros. Redondear una sola vez
  // hacia arriba evita residuos submilisegundo y nunca acorta la atención.
  // La demanda cotizada conserva sus minutos originales.
  let t = args.desde.getTime(),
    restante = milisegundosDeMinutos(args.minutos);
  const limite = t + 366 * 24 * 60 * 60000;
  const resultado: Array<Ventana & { empleadoIds: string[] }> = [];
  while (restante > 0 && t < limite) {
    const ventanas = empleados.flatMap((e) =>
      (
        args.proyectar(
          e.calendario!,
          new Date(t),
          // Una fase diminuta no debe avanzar milisegundo a milisegundo
          // hasta que coincidan personas con horarios de entrada diferentes.
          480,
        ) ?? []
      ).map((v) => ({ ...v, id: e.id })),
    );
    if (!ventanas.length) return null;
    // Avanza hasta el primer horizonte agotado y vuelve a pedir ventanas. Así
    // una jornada corta no oculta disponibilidades posteriores de esa persona.
    const hasta = Math.min(
      ...empleados.flatMap((e) => {
        const vs = ventanas.filter((v) => v.id === e.id);
        return vs.length ? [vs[vs.length - 1].fin] : [];
      }),
      limite,
    );
    if (hasta <= t) return null;
    const reservas = args.reservas.filter((r) => r.inicio < hasta && r.fin > t);
    const puntos = [
      ...new Set([
        t,
        hasta,
        ...ventanas.flatMap((v) => [v.inicio, v.fin]),
        ...reservas.flatMap((r) => [r.inicio, r.fin]),
      ]),
    ]
      .filter((p) => p >= t && p <= hasta)
      .sort((a, b) => a - b);
    for (let i = 0; i < puntos.length - 1 && restante > 0; i++) {
      const inicio = puntos[i],
        fin = puntos[i + 1];
      const ocupados = new Set(
        reservas
          .filter((r) => r.inicio < fin && r.fin > inicio)
          .flatMap((r) => r.empleadoIds ?? []),
      );
      const libres = empleados.filter(
        (e) =>
          !ocupados.has(e.id) &&
          ventanas.some(
            (v) => v.id === e.id && v.inicio <= inicio && v.fin >= fin,
          ),
      );
      if (
        libres.length < args.personas ||
        (args.obligatorioId && !libres.some((e) => e.id === args.obligatorioId))
      )
        continue;
      // Equilibrar al tomar el trabajo; no generar relevos por cada frontera
      // de reservas ajenas si la misma persona puede continuar este paso.
      const previo = resultado[resultado.length - 1];
      const continuan = previo?.fin === inicio ? previo.empleadoIds : [];
      libres.sort(
        (a, b) =>
          Number(b.id === args.obligatorioId) -
            Number(a.id === args.obligatorioId) ||
          Number(continuan.includes(b.id)) - Number(continuan.includes(a.id)) ||
          Number(b.id === args.preferidoId) -
            Number(a.id === args.preferidoId) ||
          Number(args.preferidosIds?.includes(b.id) ?? false) -
            Number(args.preferidosIds?.includes(a.id) ?? false) ||
          (carga.get(a.id) ?? 0) - (carga.get(b.id) ?? 0) ||
          a.id.localeCompare(b.id),
      );
      const duracion = Math.min(fin - inicio, restante),
        empleadoIds = libres
          .slice(0, args.personas)
          .map((e) => e.id)
          .sort();
      if (soloSeleccion)
        return [{ inicio, fin: inicio + duracion, empleadoIds }];
      for (const id of empleadoIds)
        carga.set(id, (carga.get(id) ?? 0) + duracion);
      const ultimo = resultado[resultado.length - 1];
      if (
        ultimo?.fin === inicio &&
        ultimo.empleadoIds.join('|') === empleadoIds.join('|')
      )
        ultimo.fin += duracion;
      else resultado.push({ inicio, fin: inicio + duracion, empleadoIds });
      restante -= duracion;
    }
    t = hasta;
  }
  return restante <= 0 ? resultado : null;
}
