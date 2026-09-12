/** Intervalos semiabiertos: terminar a las 10 permite empezar a las 10.
 * Espejo front/backend. Cuenta ocupación concurrente, no suma duraciones. */
export function finConflictoReserva(
  inicio: number,
  fin: number,
  intervalos: { inicio: number; fin: number }[],
  capacidad: number,
): number | null {
  if (fin <= inicio) return null;
  const solapados = intervalos.filter((r) => r.inicio < fin && r.fin > inicio);
  const puntos = [
    inicio,
    ...solapados.map((r) => Math.max(inicio, r.inicio)),
  ].sort((a, b) => a - b);
  for (const t of puntos) {
    const activos = solapados.filter((r) => r.inicio <= t && r.fin > t);
    if (activos.length >= capacidad)
      return Math.min(...activos.map((r) => r.fin));
  }
  return null;
}
