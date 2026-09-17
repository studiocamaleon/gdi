/** Referencia de cumplimiento. No reserva recursos ni modifica la agenda ETA. */
export type ReferenciaPaso = {
  inicio: string;
  fin: string;
  fijadoEl: string;
  origen: 'automatico' | 'plan_aceptado';
};
export type PlanReferenciaPaso = ReferenciaPaso & {
  version: 1;
  historial: ReferenciaPaso[];
};

export function leerPlanReferencia(value: unknown): PlanReferenciaPaso | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as PlanReferenciaPaso;
  const valido = (r: ReferenciaPaso) =>
    r &&
    ['automatico', 'plan_aceptado'].includes(r.origen) &&
    [r.inicio, r.fin, r.fijadoEl].every(
      (v) => typeof v === 'string' && Number.isFinite(Date.parse(v)),
    ) &&
    Date.parse(r.fin) >= Date.parse(r.inicio);
  return p.version === 1 &&
    valido(p) &&
    Array.isArray(p.historial) &&
    p.historial.every(valido)
    ? p
    : null;
}

export function fijarPlanReferencia(
  value: unknown,
  ventana: { inicio: Date | string; fin: Date | string },
  origen: ReferenciaPaso['origen'],
  ahora = new Date(),
): PlanReferenciaPaso {
  const anterior = leerPlanReferencia(value);
  const inicio = new Date(ventana.inicio).toISOString(),
    fin = new Date(ventana.fin).toISOString();
  if (Date.parse(fin) < Date.parse(inicio))
    throw new Error('Referencia temporal inválida.');
  // El recálculo automático nunca mueve la referencia. Sólo un plan aceptado.
  if (
    anterior &&
    (origen === 'automatico' ||
      (anterior.inicio === inicio && anterior.fin === fin))
  )
    return anterior;
  const historial = anterior
    ? [
        ...anterior.historial,
        {
          inicio: anterior.inicio,
          fin: anterior.fin,
          fijadoEl: anterior.fijadoEl,
          origen: anterior.origen,
        },
      ]
    : [];
  return {
    version: 1,
    inicio,
    fin,
    origen,
    fijadoEl: ahora.toISOString(),
    historial,
  };
}

export function proyectarPlanReferencia(value: unknown): ReferenciaPaso | null {
  const p = leerPlanReferencia(value);
  return p
    ? { inicio: p.inicio, fin: p.fin, fijadoEl: p.fijadoEl, origen: p.origen }
    : null;
}
