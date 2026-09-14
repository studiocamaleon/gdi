import type { CalendarioEstacion, PersonaProduccion } from "./estaciones";
import type { ReservaHumana } from "./capacidad-humana";

type Ventana = { inicio: number; fin: number };
type Proyectar = (
  c: CalendarioEstacion,
  d: Date,
  m: number,
) => Ventana[] | null;

/** Reserva personas identificadas; una misma persona nunca aporta dos cupos.
 * Se admiten relevos entre franjas. La dotación requerida debe estar completa
 * en cada tramo de trabajo, también cuando el paso necesita varios operarios. */
export function programarFasePersonal(args: {
  desde: Date;
  minutos: number;
  personas: number;
  empleados: PersonaProduccion[];
  reservas: ReservaHumana[];
  proyectar: Proyectar;
}): Array<Ventana & { empleadoIds: string[] }> | null {
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
    empleados.length < args.personas
  )
    return null;
  // Descarta horarios semanales sin ninguna coincidencia de la dotación.
  const coincide = Object.keys(empleados[0].calendario!.dias).some((dia) => {
    const franjas = empleados.flatMap((e) =>
      (e.calendario!.dias[dia as keyof CalendarioEstacion["dias"]] ?? []).map(
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
  let t = args.desde.getTime(),
    restante = args.minutos * 60000;
  const limite = t + 366 * 24 * 60 * 60000;
  const resultado: Array<Ventana & { empleadoIds: string[] }> = [];
  while (restante > 0.001 && t < limite) {
    const ventanas = empleados.flatMap((e) =>
      (
        args.proyectar(
          e.calendario!,
          new Date(t),
          Math.min(restante / 60000, 480),
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
    for (let i = 0; i < puntos.length - 1 && restante > 0.001; i++) {
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
      if (libres.length < args.personas) continue;
      const duracion = Math.min(fin - inicio, restante),
        empleadoIds = libres.slice(0, args.personas).map((e) => e.id);
      const ultimo = resultado[resultado.length - 1];
      if (
        ultimo?.fin === inicio &&
        ultimo.empleadoIds.join("|") === empleadoIds.join("|")
      )
        ultimo.fin += duracion;
      else resultado.push({ inicio, fin: inicio + duracion, empleadoIds });
      restante -= duracion;
    }
    t = hasta;
  }
  return restante <= 0.001 ? resultado : null;
}
