/**
 * Helper para resolver los valores "efectivos" de un ProcesoOperacion cuando
 * puede tener niveles (variantes) además de sus campos generales.
 *
 * IMPORTANTE: Este archivo tiene un mirror en
 *   apps/api/src/procesos/utils/operacion-values.ts
 * Cualquier cambio aquí debe replicarse allí.
 *
 * Casos:
 *  - Paso sin niveles → usa campos generales (maquinaId, productividadBase, etc.)
 *  - Paso con niveles → los campos generales no aplican; cada nivel tiene sus
 *    propios valores. Para la UI se expone un "resumen" (ej: "Por variante"),
 *    para cotización se resuelve con `resolveOperacionForNivel(op, nivelId)`.
 */

import type {
  ModoProductividadNivel,
  ModoProductividadProceso,
  ProcesoOperacionNivel,
  UnidadProceso,
} from '@/lib/procesos';

/**
 * Shape mínima que el helper necesita — compatible tanto con `ProcesoOperacion`
 * (usado en rutas/procesos) como con `ProcesoOperacionPlantilla` (usado en la
 * biblioteca). Las diferencias de campos opcionales se toleran con defaults.
 */
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
  niveles: ProcesoOperacionNivel[];
};

// ---------------------------------------------------------------------------
// Summary (vista resumen para tablas/listas)
// ---------------------------------------------------------------------------

export type EffectiveOperacionSummary = {
  tieneNiveles: boolean;
  nivelesCount: number;
  /** Resumen humano de la columna "Máquina". */
  maquinasSummary: string;
  /** Resumen humano de la columna "Perfil". */
  perfilesSummary: string;
  /** Resumen humano de la columna "Modo prod.". */
  modoProductividadSummary: string;
  /** Resumen humano de productividad base (con unidad si disponible). */
  productividadSummary: string;
  /** Resumen humano de tiempo (fijo o setup/run/cleanup). */
  tiempoSummary: string;
  /** Lista de nombres únicos de máquinas (para filtros de búsqueda). */
  maquinasDistintas: string[];
  /** Lista de nombres únicos de perfiles (para filtros de búsqueda). */
  perfilesDistintos: string[];
  /** IDs únicos de máquinas (general + niveles). */
  maquinaIdsDistintos: string[];
};

function nivelesActivos(op: OperacionLike): ProcesoOperacionNivel[] {
  return (op.niveles ?? []).filter((n) => n.activo);
}

function uniq(values: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const v of values) {
    if (v && v.trim().length > 0) out.add(v);
  }
  return Array.from(out);
}

function formatMaquinaLine(maquina: string, perfil: string): string {
  const m = (maquina ?? '').trim();
  const p = (perfil ?? '').trim();
  if (m && p) return `${m} · ${p}`;
  if (m) return m;
  return '';
}

function labelModoProductividadGeneral(modo: ModoProductividadProceso): string {
  return modo === 'fija' ? 'Fija' : 'Variable';
}

function labelModoProductividadNivel(modo: ModoProductividadNivel): string {
  switch (modo) {
    case 'fija':
      return 'Fija';
    case 'variable_manual':
      return 'Variable (manual)';
    case 'variable_perfil':
      return 'Variable (perfil)';
    default:
      return '—';
  }
}

function formatProductividad(
  value: number | null | undefined,
  unidadSalida: UnidadProceso | null | undefined,
  unidadTiempo: UnidadProceso | null | undefined,
): string {
  if (value == null || value <= 0) return '—';
  const salida = unidadSalida && unidadSalida !== 'ninguna' ? unidadSalida : 'u';
  const tiempo = unidadTiempo && unidadTiempo !== 'ninguna' ? unidadTiempo : 'h';
  return `${value} ${salida}/${tiempo}`;
}

function formatTiempo(
  tiempoFijoMin: number | null | undefined,
  setupMin: number | null | undefined,
  runMin: number | null | undefined,
  cleanupMin: number | null | undefined,
): string {
  if (tiempoFijoMin != null && tiempoFijoMin > 0) {
    return `${tiempoFijoMin} min fijo`;
  }
  const parts: string[] = [];
  if (setupMin != null && setupMin > 0) parts.push(`setup ${setupMin}`);
  if (runMin != null && runMin > 0) parts.push(`run ${runMin}`);
  if (cleanupMin != null && cleanupMin > 0) parts.push(`cleanup ${cleanupMin}`);
  if (parts.length === 0) return '—';
  return parts.join(' · ') + ' min';
}

/**
 * Devuelve un resumen "efectivo" del paso para mostrar en tablas/listas.
 * Si el paso tiene niveles, los campos reflejan el conjunto (ej: "Por variante").
 */
export function getOperacionSummary(
  op: OperacionLike,
): EffectiveOperacionSummary {
  const niveles = nivelesActivos(op);
  const tieneNiveles = niveles.length > 0;

  if (!tieneNiveles) {
    const maquinasDistintas = uniq([op.maquinaNombre]);
    const perfilesDistintos = uniq([op.perfilOperativoNombre]);
    const maquinaIdsDistintos = uniq([op.maquinaId]);
    const maqLine = formatMaquinaLine(
      op.maquinaNombre ?? '',
      op.perfilOperativoNombre ?? '',
    );
    return {
      tieneNiveles: false,
      nivelesCount: 0,
      maquinasSummary: maqLine.length > 0 ? maqLine : 'Sin máquina',
      perfilesSummary: perfilesDistintos[0] ?? '—',
      modoProductividadSummary: labelModoProductividadGeneral(
        op.modoProductividad,
      ),
      productividadSummary: formatProductividad(
        op.productividadBase,
        op.unidadSalida,
        op.unidadTiempo,
      ),
      tiempoSummary: formatTiempo(
        op.tiempoFijoMin,
        op.setupMin,
        op.runMin ?? null,
        op.cleanupMin,
      ),
      maquinasDistintas,
      perfilesDistintos,
      maquinaIdsDistintos,
    };
  }

  // Con niveles: resumir
  const maquinasDistintas = uniq([
    op.maquinaNombre,
    ...niveles.map((n) => n.maquinaNombre),
  ]);
  const perfilesDistintos = uniq([
    op.perfilOperativoNombre,
    ...niveles.map((n) => n.perfilOperativoNombre),
  ]);
  const maquinaIdsDistintos = uniq([
    op.maquinaId,
    ...niveles.map((n) => n.maquinaId),
  ]);

  let maquinasSummary: string;
  if (maquinasDistintas.length === 0) {
    maquinasSummary = `${niveles.length} variante${niveles.length > 1 ? 's' : ''} · sin máquina`;
  } else if (maquinasDistintas.length === 1) {
    const perfilLabel =
      perfilesDistintos.length === 1
        ? perfilesDistintos[0]
        : perfilesDistintos.length > 1
          ? `${perfilesDistintos.length} perfiles`
          : '';
    const line = formatMaquinaLine(maquinasDistintas[0], perfilLabel);
    maquinasSummary = `${niveles.length} variante${niveles.length > 1 ? 's' : ''} · ${line}`;
  } else {
    maquinasSummary = `${niveles.length} variantes · ${maquinasDistintas.length} máquinas`;
  }

  const perfilesSummary =
    perfilesDistintos.length === 0
      ? '—'
      : perfilesDistintos.length === 1
        ? perfilesDistintos[0]
        : `${perfilesDistintos.length} perfiles`;

  // Modo: "Por variante" si hay más de un modo entre niveles, sino el único
  const modos = uniq(niveles.map((n) => labelModoProductividadNivel(n.modoProductividadNivel)));
  const modoProductividadSummary =
    modos.length === 1 ? modos[0] : 'Por variante';

  // Productividad: si todas coinciden muestra el valor, sino "Por variante"
  const productividades = uniq(
    niveles.map((n) =>
      formatProductividad(n.productividadBase, n.unidadSalida, n.unidadTiempo),
    ),
  );
  const productividadSummary =
    productividades.length === 1 ? productividades[0] : 'Por variante';

  // Tiempo: ídem
  const tiempos = uniq(
    niveles.map((n) =>
      formatTiempo(n.tiempoFijoMin, null, n.setupMin, n.cleanupMin),
    ),
  );
  const tiempoSummary = tiempos.length === 1 ? tiempos[0] : 'Por variante';

  return {
    tieneNiveles: true,
    nivelesCount: niveles.length,
    maquinasSummary,
    perfilesSummary,
    modoProductividadSummary,
    productividadSummary,
    tiempoSummary,
    maquinasDistintas,
    perfilesDistintos,
    maquinaIdsDistintos,
  };
}

// ---------------------------------------------------------------------------
// Resolución para cotización
// ---------------------------------------------------------------------------

export type ResolvedOperacionValues = {
  maquinaId: string | null;
  maquinaNombre: string | null;
  perfilOperativoId: string | null;
  perfilOperativoNombre: string | null;
  /**
   * Modo en el sentido del motor (fija/variable). Si el nivel es
   * `variable_manual` o `variable_perfil`, devuelve 'variable'.
   */
  modoProductividad: ModoProductividadProceso;
  productividadBase: number | null;
  tiempoFijoMin: number | null;
  setupMin: number | null;
  cleanupMin: number | null;
  runMin: number | null;
  unidadSalida: UnidadProceso | null;
  unidadTiempo: UnidadProceso | null;
  /** ID del nivel usado (null si resolvió del campo general). */
  nivelId: string | null;
  /** Nombre del nivel usado (null si resolvió del campo general). */
  nivelNombre: string | null;
};

function modoNivelToMotor(modo: ModoProductividadNivel): ModoProductividadProceso {
  return modo === 'fija' ? 'fija' : 'variable';
}

/**
 * Resuelve los valores de ejecución para un paso.
 *
 * - Si el paso NO tiene niveles → devuelve los campos generales.
 * - Si el paso tiene niveles y se pasa `nivelId` válido → devuelve los valores
 *   del nivel (fallback a generales solo cuando el nivel no define un campo).
 * - Si el paso tiene niveles y NO se pasa `nivelId` (o es inválido) → devuelve
 *   null, indicando que falta resolución.
 */
export function resolveOperacionForNivel(
  op: OperacionLike,
  nivelId?: string | null,
): ResolvedOperacionValues | null {
  const niveles = nivelesActivos(op);
  const tieneNiveles = niveles.length > 0;

  if (!tieneNiveles) {
    return {
      maquinaId: op.maquinaId || null,
      maquinaNombre: op.maquinaNombre || null,
      perfilOperativoId: op.perfilOperativoId || null,
      perfilOperativoNombre: op.perfilOperativoNombre || null,
      modoProductividad: op.modoProductividad,
      productividadBase: op.productividadBase,
      tiempoFijoMin: op.tiempoFijoMin,
      setupMin: op.setupMin,
      cleanupMin: op.cleanupMin,
      runMin: op.runMin ?? null,
      unidadSalida: op.unidadSalida,
      unidadTiempo: op.unidadTiempo,
      nivelId: null,
      nivelNombre: null,
    };
  }

  if (!nivelId) return null;
  const nivel = niveles.find((n) => n.id === nivelId);
  if (!nivel) return null;

  return {
    maquinaId: nivel.maquinaId || null,
    maquinaNombre: nivel.maquinaNombre || null,
    perfilOperativoId: nivel.perfilOperativoId || null,
    perfilOperativoNombre: nivel.perfilOperativoNombre || null,
    modoProductividad: modoNivelToMotor(nivel.modoProductividadNivel),
    productividadBase: nivel.productividadBase,
    tiempoFijoMin: nivel.tiempoFijoMin,
    setupMin: nivel.setupMin,
    cleanupMin: nivel.cleanupMin,
    // Los niveles no tienen runMin ni los delegan → fallback a general.
    runMin: op.runMin ?? null,
    unidadSalida: nivel.unidadSalida ?? op.unidadSalida,
    unidadTiempo: nivel.unidadTiempo ?? op.unidadTiempo,
    nivelId: nivel.id,
    nivelNombre: nivel.nombre,
  };
}

/** true si el paso tiene niveles activos. */
export function operacionTieneNiveles(op: OperacionLike): boolean {
  return nivelesActivos(op).length > 0;
}
