/**
 * G-M2 — Cálculo de outputs canónicos por familia.
 *
 * Cada familia declara en `familias.ts:outputsCanonicos: string[]` qué
 * outputs publica al `JobContext` mutado para que pasos siguientes los
 * hereden. Antes de G-M2 todos eran `null` (placeholder).
 *
 * Este módulo agrupa la lógica de cómo cada familia llena sus outputs:
 *  - `pre_prensa` → corre el nesting de imposición y publica
 *    `pliegos_calculados`, `poses_por_pliego`, `imposicion_calculada`,
 *    `cortes_calculados`.
 *  - `impresion_por_hoja` → publica `pliegos_impresos` (= cantidad
 *    efectiva del paso) y `tiempo_real_impresion`.
 *  - `impresion_por_area` → publica `m2_calculados`, `aprovechamiento_pct`,
 *    `tiempo_real_impresion`.
 *  - Familias de corte → `piezas_cortadas`, `tiempo_real_corte`,
 *    `metros_lineales_corte`.
 *  - Resto → fallback razonable: la mayoría son `piezas_X = cantidadEfectiva`.
 *
 * El consumidor (motor) usa estos outputs para:
 *  1. Mutar el `jobContext` con flat keys (`jobContext[outputName] = value`)
 *     para que `HEREDAR_DEL_OUTPUT_CANONICO` los lea.
 *  2. Validar `EXISTS_OUTPUT` chequeando que el output haya sido publicado.
 *  3. Mostrar trazabilidad por paso en el frontend.
 */

import type { DefinicionFamilia } from '../productos-servicios/pasos/types';
import { calculateGuillotinaCutsFromImposicion } from '../productos-servicios/nesting/helpers/guillotina-cuts';
import type {
  PasoCargado,
  JobContext,
  MaterialEjecutado,
  PasoEjecutado,
} from './tipos';
import type { NestingDispatchResult } from './nesting-dispatcher';

export interface OutputContext {
  paso: PasoCargado;
  jobContext: JobContext;
  /** Tiempo calculado en este paso (si activado). */
  tiempo?: PasoEjecutado['tiempo'];
  /** Materiales consumidos en este paso. */
  materiales?: MaterialEjecutado[];
  /** Resultado del nesting (G-M1) o look-ahead pre_prensa (G-M2). */
  nestingDispatch: NestingDispatchResult | null;
  /** Cantidad efectiva: la que el paso "produjo" (pliegos, m2, piezas, etc.). */
  cantidadEfectiva: number;
}

export function calcularOutputsCanonicos(
  familia: DefinicionFamilia | undefined,
  ctx: OutputContext,
): Record<string, unknown> {
  if (!familia) return {};
  const declarados = familia.outputsCanonicos;
  if (!declarados || declarados.length === 0) return {};

  const outputs: Record<string, unknown> = {};

  for (const key of declarados) {
    outputs[key] = computeOutput(key, familia, ctx);
  }

  return outputs;
}

/**
 * Resuelve el valor de UN output canónico según su nombre + familia + ctx.
 *
 * Ordenado de específico a genérico:
 *  - Outputs estructurados (imposicion_calculada): objeto con detalle del nesting.
 *  - Outputs numéricos derivados del nesting (pliegos_calculados, poses_por_pliego,
 *    m2_calculados, aprovechamiento_pct).
 *  - Outputs derivados del tiempo (tiempo_real_impresion, tiempo_real_corte).
 *  - Outputs derivados de cantidad efectiva (piezas_X, libros_X, cajas_X, ...).
 *  - Outputs derivados de materiales (metros_lineales_film).
 *  - Default: cantidad efectiva o null.
 */
function computeOutput(
  key: string,
  familia: DefinicionFamilia,
  ctx: OutputContext,
): unknown {
  const {
    paso,
    jobContext,
    tiempo,
    materiales,
    nestingDispatch,
    cantidadEfectiva,
  } = ctx;

  // ─── Outputs estructurados del nesting de imposición ──────────────
  if (
    key === 'imposicion_calculada' &&
    nestingDispatch?.algorithm === 'grid-2d-single'
  ) {
    return {
      algorithm: nestingDispatch.algorithm,
      piezasPorPliego: nestingDispatch.piezasPorPliego,
      pliegosNecesarios: nestingDispatch.cantidadCalculada,
      aprovechamientoPct: nestingDispatch.aprovechamientoPct,
      placements: nestingDispatch.placements,
      substrates: nestingDispatch.substrates,
    };
  }

  if (
    key === 'cortes_calculados' &&
    nestingDispatch?.algorithm === 'grid-2d-single'
  ) {
    // Cortes de guillotina derivados de la imposición:
    // - sin demasía: columnas + filas + 2
    // - con demasía: 2 * columnas + 2 * filas
    const m = nestingDispatch.metricasRaw;
    const filas = m.filas ?? 0;
    const columnas = m.columnas ?? 0;
    const demasiaMm = nestingDispatch.visualConfig?.pieceBleedMm ?? 0;
    const cortesTotales = calculateGuillotinaCutsFromImposicion({
      cols: columnas,
      rows: filas,
      demasiaCorteMm: demasiaMm,
    });
    return {
      columnas,
      filas,
      demasiaMm,
      cortesTotales,
      formula:
        demasiaMm > 0
          ? '2 * columnas + 2 * filas'
          : 'columnas + filas + 2',
    };
  }

  // ─── Outputs numéricos del nesting de imposición ──────────────────
  if (key === 'pliegos_calculados') {
    if (
      nestingDispatch?.algorithm === 'grid-2d-single' ||
      nestingDispatch?.algorithm === 'grid-2d-multi' ||
      nestingDispatch?.algorithm === 'packingsolver-rectangle'
    ) {
      return nestingDispatch.cantidadCalculada;
    }
    // Fallback: no se pudo calcular nesting → null para que EXISTS_OUTPUT
    // detecte la falta y los siguientes pasos no hereden basura.
    return null;
  }

  if (key === 'poses_por_pliego') {
    if (nestingDispatch?.algorithm === 'grid-2d-single') {
      return nestingDispatch.piezasPorPliego ?? null;
    }
    return null;
  }

  if (key === 'pliegos_impresos') {
    // Cantidad efectiva del paso (impresion_por_hoja), que viene del
    // dispatcher si es CALCULADO_POR_PASO, o del jobContext heredado si es
    // HEREDAR_DEL_OUTPUT_CANONICO.
    return cantidadEfectiva || null;
  }

  if (key === 'pliego_impresion_ancho_mm') {
    const sheet = nestingDispatch?.substrates.find((sub) => sub.kind === 'sheet');
    return sheet?.kind === 'sheet' ? sheet.widthMm : null;
  }

  if (key === 'pliego_impresion_alto_mm') {
    const sheet = nestingDispatch?.substrates.find((sub) => sub.kind === 'sheet');
    return sheet?.kind === 'sheet' ? sheet.heightMm : null;
  }

  if (key === 'pliego_impresion_area_m2') {
    const sheet = nestingDispatch?.substrates.find((sub) => sub.kind === 'sheet');
    if (sheet?.kind !== 'sheet') return null;
    return (sheet.widthMm * sheet.heightMm) / 1_000_000;
  }

  if (key === 'talonario_pilas') {
    // Pilas de pliegos que se abrochan/cortan juntas (talonario grouping).
    // Base de cantidad para insumos por pila (ej. cartón de contratapa) en
    // pasos posteriores (abrochado/corte) vía cantidadBase='talonario_pilas'.
    return nestingDispatch?.talonarioGrouping?.pilas ?? null;
  }

  if (key === 'pliego_impresion_mp_variante_id') {
    // MP propia del candidato ganador (origen de costo 'por_candidato').
    // La publica pre_prensa para que el paso de impresión (HEREDAR) costee
    // el sustrato con la variante real y no con la MP fija del slot.
    return (
      nestingDispatch?.pliegoImpresionSeleccionado?.materiaPrima?.varianteId ??
      null
    );
  }

  if (key === 'm2_calculados') {
    if (
      nestingDispatch?.algorithm === 'shelf-rollo' ||
      nestingDispatch?.algorithm === 'maxrects-rollo'
    ) {
      // m² REALES consumidos del rollo (incluye desperdicio).
      const sub = nestingDispatch.substrates[0];
      if (sub?.kind === 'roll') {
        return (sub.lengthMm * sub.widthMm) / 1_000_000;
      }
    }
    if (
      nestingDispatch?.algorithm === 'grid-2d-multi' ||
      nestingDispatch?.algorithm === 'packingsolver-rectangle'
    ) {
      return nestingDispatch.substrates.reduce((acc, sub) => {
        if (sub.kind !== 'sheet') return acc;
        return acc + (sub.count * sub.widthMm * sub.heightMm) / 1_000_000;
      }, 0);
    }
    return null;
  }

  if (key === 'aprovechamiento_pct') {
    return nestingDispatch?.aprovechamientoPct ?? null;
  }

  // ─── Outputs derivados del tiempo ─────────────────────────────────
  if (key === 'tiempo_real_impresion' || key === 'tiempo_real_corte') {
    return tiempo?.totalMin ?? null;
  }

  // ─── Outputs derivados de materiales ──────────────────────────────
  if (key === 'metros_lineales_film' && materiales) {
    const film = materiales.find(
      (m) => m.slotCodigo === 'film' || /film/i.test(m.materialNombre),
    );
    return film?.cantidad ?? null;
  }

  if (key === 'metros_lineales_corte') {
    if (
      nestingDispatch?.algorithm === 'shelf-rollo' ||
      nestingDispatch?.algorithm === 'maxrects-rollo'
    ) {
      return (nestingDispatch.consumedLengthMm ?? 0) / 1000;
    }
    return null;
  }

  if (key === 'piezas_laminadas' && familia.codigo === 'plastificado_pouch') {
    return Number(jobContext.cantidad ?? 0) || null;
  }

  // ─── Outputs "X realizados" — la mayoría son cantidad efectiva ────
  // piezas_impresas, piezas_cortadas, piezas_aplicadas, piezas_grabadas,
  // piezas_troqueladas, piezas_perforadas, piezas_laminadas, piezas_barnizadas,
  // piezas_decoradas, piezas_pintadas, piezas_lijadas, piezas_soldadas,
  // piezas_ensambladas, piezas_contadas, libros_engrapados, libros_anillados,
  // blocks_emblocados, cajas_armadas, cajas_embaladas, atados_completados,
  // trabajos_manuales_realizados, luminosos_instalados, pliegos_plegados, etc.
  if (
    key.startsWith('piezas_') ||
    key.startsWith('libros_') ||
    key.startsWith('blocks_') ||
    key.startsWith('cajas_') ||
    key.startsWith('atados_') ||
    key.startsWith('trabajos_') ||
    key.startsWith('luminosos_') ||
    key.startsWith('pliegos_')
  ) {
    return cantidadEfectiva || null;
  }

  // ─── Casos puntuales ──────────────────────────────────────────────
  if (key === 'proof_aprobado') {
    // Si el paso se ejecutó sin errores, asumimos proof aprobado.
    return true;
  }

  // Defensivo: si la familia declara un output no contemplado, devolver
  // cantidad efectiva como mejor-esfuerzo (no romper).
  void paso;
  void jobContext;
  return cantidadEfectiva || null;
}
