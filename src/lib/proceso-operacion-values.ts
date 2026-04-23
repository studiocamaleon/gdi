/**
 * Helper de resumen para mostrar un `ProcesoOperacion` o `ProcesoOperacionPlantilla`
 * en tablas/listas de la biblioteca.
 *
 * P4.1 — Los `niveles` (variantes) del v1 fueron consolidados en
 * `ProcesoOperacionAlternativa` con overrides. Esta función ya no sabe de
 * niveles — asume que los datos base del paso son la única fuente.
 */

import type {
  ModoProductividadProceso,
  UnidadProceso,
} from '@/lib/procesos';

export type OperacionLike = {
  maquinaId: string | null;
  maquinaNombre: string;
  perfilOperativoId: string | null;
  perfilOperativoNombre: string;
  modoProductividad: ModoProductividadProceso;
  productividadBase: number | null;
  tiempoFijoMin: number | null;
  setupMin: number | null;
  cleanupMin: number | null;
  runMin?: number | null;
  unidadSalida: UnidadProceso;
  unidadTiempo: UnidadProceso;
};

export type EffectiveOperacionSummary = {
  maquinasSummary: string;
  perfilesSummary: string;
  modoProductividadSummary: string;
  productividadSummary: string;
  tiempoSummary: string;
  maquinasDistintas: string[];
  perfilesDistintos: string[];
  maquinaIdsDistintos: string[];
};

const MODO_LABELS: Record<ModoProductividadProceso, string> = {
  tiempo_fijo: 'Tiempo fijo',
  fija: 'Productividad propia',
  productividad_maquina: 'Productividad de máquina',
  variable: 'Productividad propia', // alias legacy de fija
  formula: 'Fórmula',
};

function formatModo(modo: ModoProductividadProceso): string {
  return MODO_LABELS[modo] ?? String(modo);
}

function formatUnidad(unidad: UnidadProceso | null | undefined): string {
  if (!unidad || unidad === 'ninguna') return '';
  return String(unidad);
}

export function getOperacionSummary(op: OperacionLike): EffectiveOperacionSummary {
  const maquinaLabel = op.maquinaNombre?.trim() || '—';
  const perfilLabel = op.perfilOperativoNombre?.trim() || '—';

  const productividadValue = op.productividadBase;
  const tiempoFijo = op.tiempoFijoMin;
  const setup = op.setupMin;
  const run = op.runMin ?? null;
  const cleanup = op.cleanupMin;

  const productividadSummary =
    productividadValue != null && productividadValue > 0
      ? `${productividadValue} ${formatUnidad(op.unidadSalida)}/h`.trim()
      : '—';

  let tiempoSummary = '—';
  if (tiempoFijo != null && tiempoFijo > 0) {
    tiempoSummary = `${tiempoFijo} min fijos`;
  } else {
    const parts: string[] = [];
    if (setup != null && setup > 0) parts.push(`setup ${setup}m`);
    if (run != null && run > 0) parts.push(`run ${run}m`);
    if (cleanup != null && cleanup > 0) parts.push(`cleanup ${cleanup}m`);
    if (parts.length > 0) tiempoSummary = parts.join(' · ');
  }

  return {
    maquinasSummary: maquinaLabel,
    perfilesSummary: perfilLabel,
    modoProductividadSummary: formatModo(op.modoProductividad),
    productividadSummary,
    tiempoSummary,
    maquinasDistintas: op.maquinaNombre ? [op.maquinaNombre] : [],
    perfilesDistintos: op.perfilOperativoNombre ? [op.perfilOperativoNombre] : [],
    maquinaIdsDistintos: op.maquinaId ? [op.maquinaId] : [],
  };
}
