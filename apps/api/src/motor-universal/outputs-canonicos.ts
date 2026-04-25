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
import type { PasoCargado, JobContext, MaterialEjecutado, PasoEjecutado } from './tipos';
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
  const { paso, jobContext, tiempo, materiales, nestingDispatch, cantidadEfectiva } = ctx;

  // ─── Outputs estructurados del nesting de imposición ──────────────
  if (key === 'imposicion_calculada' && nestingDispatch?.algorithm === 'grid-2d-single') {
    return {
      algorithm: nestingDispatch.algorithm,
      piezasPorPliego: nestingDispatch.piezasPorPliego,
      pliegosNecesarios: nestingDispatch.cantidadCalculada,
      aprovechamientoPct: nestingDispatch.aprovechamientoPct,
      placements: nestingDispatch.placements,
      substrates: nestingDispatch.substrates,
    };
  }

  if (key === 'cortes_calculados' && nestingDispatch?.algorithm === 'grid-2d-single') {
    // Cortes derivados del grid: filas + columnas - 1 cortes en cada eje.
    const m = nestingDispatch.metricasRaw;
    const filas = m.filas ?? 0;
    const columnas = m.columnas ?? 0;
    return {
      cortesHorizontales: Math.max(0, filas - 1),
      cortesVerticales: Math.max(0, columnas - 1),
      cortesTotales: Math.max(0, filas - 1 + columnas - 1),
    };
  }

  // ─── Outputs numéricos del nesting de imposición ──────────────────
  if (key === 'pliegos_calculados') {
    if (nestingDispatch?.algorithm === 'grid-2d-single') {
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

  if (key === 'm2_calculados') {
    if (nestingDispatch?.algorithm === 'shelf-rollo') {
      // m² REALES consumidos del rollo (incluye desperdicio).
      const sub = nestingDispatch.substrates[0];
      if (sub?.kind === 'roll') {
        return (sub.lengthMm * sub.widthMm) / 1_000_000;
      }
    }
    return null;
  }

  if (key === 'aprovechamiento_pct') {
    return nestingDispatch?.aprovechamientoPct ?? null;
  }

  // ─── Outputs derivados del tiempo ─────────────────────────────────
  if (
    key === 'tiempo_real_impresion' ||
    key === 'tiempo_real_corte'
  ) {
    return tiempo?.totalMin ?? null;
  }

  // ─── Outputs derivados de materiales ──────────────────────────────
  if (key === 'metros_lineales_film' && materiales) {
    const film = materiales.find((m) => m.slotCodigo === 'film' || /film/i.test(m.materialNombre));
    return film?.cantidad ?? null;
  }

  if (key === 'metros_lineales_corte') {
    if (nestingDispatch?.algorithm === 'shelf-rollo') {
      return (nestingDispatch.consumedLengthMm ?? 0) / 1000;
    }
    return null;
  }

  // ─── Outputs "X realizados" — la mayoría son cantidad efectiva ────
  // piezas_impresas, piezas_cortadas, piezas_aplicadas, piezas_grabadas,
  // piezas_troqueladas, piezas_perforadas, piezas_laminadas, piezas_barnizadas,
  // piezas_decoradas, piezas_pintadas, piezas_lijadas, piezas_soldadas,
  // piezas_ensambladas, piezas_contadas, libros_engrapados, libros_anillados,
  // blocks_emblocados, cajas_armadas, cajas_embaladas, atados_completados,
  // luminosos_instalados, pliegos_plegados, etc.
  if (
    key.startsWith('piezas_') ||
    key.startsWith('libros_') ||
    key.startsWith('blocks_') ||
    key.startsWith('cajas_') ||
    key.startsWith('atados_') ||
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
