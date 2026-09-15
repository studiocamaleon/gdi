/** Decisión humana persistente, separada del resultado de planificación. */
export type AsignacionManualPersonal = {
  version: 1;
  revision: string;
  empleadoIds: string[];
  asignadoEl: string;
  usuarioId: string;
  usuarioNombre: string;
};

export function leerAsignacionManual(
  value: unknown,
): AsignacionManualPersonal | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as AsignacionManualPersonal;
  if (
    a.version !== 1 ||
    !Array.isArray(a.empleadoIds) ||
    !a.empleadoIds.length ||
    a.empleadoIds.some((id) => typeof id !== 'string' || !id) ||
    new Set(a.empleadoIds).size !== a.empleadoIds.length ||
    typeof a.revision !== 'string' ||
    typeof a.usuarioId !== 'string' ||
    typeof a.usuarioNombre !== 'string' ||
    !Number.isFinite(Date.parse(a.asignadoEl))
  )
    return null;
  return a;
}
