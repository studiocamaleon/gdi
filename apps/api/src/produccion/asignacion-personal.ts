import { leerAsignacionManual } from './asignacion-manual';

/** Datos de planificación, nunca prueba de asistencia o de trabajo realizado. */
export type AsignacionPersonal = {
  version: 1;
  origen: 'automatica' | 'manual';
  personas: Array<{
    empleadoId: string;
    nombre: string;
    usuarioId: string | null;
  }>;
  franjas: Array<{ inicio: string; fin: string; empleadoIds: string[] }>;
  conflicto: string | null;
};

export function leerAsignacionPersonal(
  value: unknown,
): AsignacionPersonal | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as AsignacionPersonal;
  if (
    a.version !== 1 ||
    !['automatica', 'manual'].includes(a.origen) ||
    !Array.isArray(a.personas) ||
    !Array.isArray(a.franjas) ||
    (a.conflicto !== null && typeof a.conflicto !== 'string')
  )
    return null;
  if (
    a.personas.some(
      (p) =>
        !p ||
        typeof p.empleadoId !== 'string' ||
        typeof p.nombre !== 'string' ||
        (p.usuarioId !== null && typeof p.usuarioId !== 'string'),
    )
  )
    return null;
  const ids = new Set(a.personas.map((p) => p.empleadoId));
  if (
    ids.size !== a.personas.length ||
    a.franjas.some(
      (f) =>
        !f ||
        !Number.isFinite(Date.parse(f.inicio)) ||
        !Number.isFinite(Date.parse(f.fin)) ||
        Date.parse(f.fin) <= Date.parse(f.inicio) ||
        !Array.isArray(f.empleadoIds) ||
        new Set(f.empleadoIds).size !== f.empleadoIds.length ||
        f.empleadoIds.some((id) => !ids.has(id)),
    )
  )
    return null;
  return a;
}

export function proyectarAsignacionPersonal(value: unknown, usuarioId: string) {
  const a = leerAsignacionPersonal(value);
  return a
    ? {
        origen: a.origen,
        personas: a.personas.map(({ empleadoId, nombre }) => ({
          empleadoId,
          nombre,
        })),
        franjas: a.franjas,
        conflicto: a.conflicto,
        esMia: a.personas.some((p) => p.usuarioId === usuarioId),
      }
    : null;
}

export type PersonalFijo = {
  empleadoIds?: string[];
  obligatorioId?: string;
  preferidoId?: string;
};

/** Un reclamo manual exige esa persona y completa la dotación con el motor.
 * Una ejecución iniciada conserva su personal, incluidos los relevos previstos. */
export function personalFijoDelPaso(
  paso: {
    estado: string;
    iniciadoEl?: unknown;
    asignacionPersonalJson?: unknown;
    asignacionManualJson?: unknown;
    mesaUsuarioId?: string | null;
    operadorActualUsuarioId?: string | null;
  },
  empleados: Array<{ id: string; userId: string | null }>,
): PersonalFijo | undefined {
  const a = leerAsignacionPersonal(paso.asignacionPersonalJson);
  const manual = leerAsignacionManual(paso.asignacionManualJson);
  const iniciado =
    !!paso.iniciadoEl || ['en_curso', 'pausado'].includes(paso.estado);
  const preferidoId = empleados.find(
    (e) => e.userId && e.userId === paso.operadorActualUsuarioId,
  )?.id;
  if (manual)
    return {
      empleadoIds: [
        ...new Set([
          ...manual.empleadoIds,
          ...(iniciado && preferidoId ? [preferidoId] : []),
        ]),
      ],
      preferidoId,
    };
  const obligatorioId = paso.mesaUsuarioId
    ? (empleados.find((e) => e.userId === paso.mesaUsuarioId)?.id ??
      '@sin-empleado')
    : undefined;
  return iniciado && a?.personas.length
    ? {
        empleadoIds: [
          ...new Set([
            ...a.personas.map((p) => p.empleadoId),
            ...(obligatorioId ? [obligatorioId] : []),
            ...(preferidoId ? [preferidoId] : []),
          ]),
        ],
        obligatorioId,
        preferidoId,
      }
    : obligatorioId || preferidoId
      ? { obligatorioId, preferidoId }
      : undefined;
}
