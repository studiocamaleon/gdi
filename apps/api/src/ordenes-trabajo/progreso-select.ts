import type { Prisma } from '@prisma/client';

/** Sólo escalares: el progreso nunca carga snapshots de cotización ni CAD. */
export const pasosProgresoSelect = {
  estado: true,
  duracionEstimadaMin: true,
  nestingLoteRol: true,
} as const satisfies Prisma.OrdenTrabajoItemPasoSelect;
