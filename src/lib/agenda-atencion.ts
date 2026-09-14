import type { DemandaHumana } from "./demanda-humana";
import type {
  CalendarioEstacion,
  EquipoProduccion,
  PersonaProduccion,
} from "./estaciones";
import type { PlanAtencion, ReservaHumana } from "./capacidad-humana";

/** Agenda productiva aceptada, separada de las fases y tiempos cotizados. */
export type AtencionPlanificada = {
  version: 1;
  contexto: string;
  inicio: number;
  fin: number;
  finOcupacion: number;
  reservas: ReservaHumana[];
};

export function contextoAtencion(args: {
  demanda: DemandaHumana;
  calendario: CalendarioEstacion;
  equipo?: EquipoProduccion | null;
  empleados?: PersonaProduccion[];
  preparacionMin: number;
  zona: string;
  noLaborables: Set<string>;
}): string {
  const { equipo } = args;
  return JSON.stringify(
    ordenar({
      ...(args.empleados !== undefined
        ? {
            politicaPersonal: "misma-dotacion-por-paso-v1",
            empleados: [...args.empleados].sort((a, b) =>
              a.id.localeCompare(b.id),
            ),
          }
        : {}),
      demanda: args.demanda,
      calendario: args.calendario,
      equipo: equipo
        ? {
            id: equipo.id,
            activo: equipo.activo,
            personas: equipo.personas,
            calendario: equipo.calendario,
          }
        : null,
      preparacionMin: args.preparacionMin,
      zona: args.zona,
      noLaborables: [...args.noLaborables].sort(),
    }),
  );
}

export function guardarAtencion(
  plan: PlanAtencion,
  contexto: string,
): AtencionPlanificada {
  return {
    version: 1,
    contexto,
    inicio: plan.inicio.getTime(),
    fin: plan.fin.getTime(),
    finOcupacion: plan.finOcupacion.getTime(),
    reservas: plan.reservas.map(({ inicio, fin, personas, empleadoIds }) => ({
      inicio,
      fin,
      personas,
      ...(empleadoIds ? { empleadoIds: [...empleadoIds] } : {}),
    })),
  };
}

/** Una agenda vencida por cambios de configuración nunca impone capacidad antigua. */
export function leerAtencionPlanificada(
  value: unknown,
  contexto: string,
  inicio: number,
  fin: number,
): AtencionPlanificada | null {
  if (!value || typeof value !== "object") return null;
  const p = value as AtencionPlanificada;
  if (
    p.version !== 1 ||
    p.contexto !== contexto ||
    p.inicio !== inicio ||
    p.fin !== fin ||
    !Number.isFinite(p.finOcupacion) ||
    p.finOcupacion < fin ||
    !Array.isArray(p.reservas)
  )
    return null;
  if (
    p.reservas.some(
      (r) =>
        !r ||
        !Number.isFinite(r.inicio) ||
        !Number.isFinite(r.fin) ||
        r.inicio < inicio ||
        r.fin > p.finOcupacion ||
        r.fin <= r.inicio ||
        !Number.isInteger(r.personas) ||
        r.personas < 1 ||
        (r.empleadoIds !== undefined &&
          (!Array.isArray(r.empleadoIds) ||
            r.empleadoIds.length !== r.personas ||
            new Set(r.empleadoIds).size !== r.empleadoIds.length ||
            r.empleadoIds.some((id) => typeof id !== "string" || !id))),
    )
  )
    return null;
  return p;
}

/** PostgreSQL JSONB no conserva el orden de las claves. */
function ordenar(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordenar);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, ordenar(v)]),
    );
  return value;
}
