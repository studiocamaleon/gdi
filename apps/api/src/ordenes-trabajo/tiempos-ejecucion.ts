export function sumaTramosMin(
  tramos: Array<{ inicioEl: Date; finEl: Date | null }>,
): number {
  return tramos.reduce((acc, tramo) => {
    if (!tramo.finEl) return acc;
    return acc + (tramo.finEl.getTime() - tramo.inicioEl.getTime()) / 60_000;
  }, 0);
}
