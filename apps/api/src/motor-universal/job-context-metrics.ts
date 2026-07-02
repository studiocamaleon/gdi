import type { JobContext } from './tipos';

export function calcularPerimetroPiezasM(jobContext: Pick<JobContext, 'piezas'>) {
  if (!jobContext.piezas || jobContext.piezas.length === 0) return 0;
  return jobContext.piezas.reduce((acc, p) => {
    const perimetroMm =
      Number.isFinite(Number(p.perimetroMm)) && Number(p.perimetroMm) > 0
        ? Number(p.perimetroMm)
        : 2 * (Number(p.anchoMm ?? 0) + Number(p.altoMm ?? 0));
    if (!Number.isFinite(perimetroMm) || perimetroMm <= 0) return acc;
    return acc + (perimetroMm / 1000) * p.cantidad;
  }, 0);
}
