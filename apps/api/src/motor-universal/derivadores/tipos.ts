/**
 * Derivadores geométricos — el contrato (docs/derivadores-geometricos-diseno.md §3).
 *
 * Un derivador es la primitiva "geometría que nadie carga a mano": de las
 * medidas del JobContext + los params efectivos del paso (+ los atributos del
 * material principal, si la familia lo declara) salen las magnitudes que
 * alimentan cantidad del paso, outputs canónicos, slots y guards.
 *
 * Reglas:
 *  - Función PURA con specs. La geometría es código Tipo B (shoelace, packing,
 *    desarrollo de chapa no se expresan en un DSL); todo lo que la rodea es
 *    dato declarado en la familia (`derivadorCodigo`, `magnitudPrincipal`,
 *    `outputsDesdeDerivador`, `mensajeSinDatos`).
 *  - Devuelve `null` cuando no puede derivar (cajón doble sin profundidad,
 *    módulo LED sin cobertura, ojales sin lados) — el motor emite el error
 *    genérico `derivador_sin_datos` con el mensaje declarado por la familia.
 *    Nada de $0 silencioso.
 *  - Se ejecuta UNA vez por paso; el motor cachea el resultado en el
 *    JobContext bajo `KEY_DERIVACIONES_POR_PASO` (clave reservada, mismo
 *    patrón que las capacidades B.3.3).
 */
import type { JobContext } from '../tipos';

export interface ResultadoDerivador {
  /**
   * Magnitudes derivadas, por nombre camelCase (mlTotal, puntosSoldadura,
   * modulos, cableMl…). La familia mapea estas claves a su cantidad de paso
   * (`magnitudPrincipal`) y a sus outputs (`outputsDesdeDerivador`).
   */
  magnitudes: Record<string, number>;
  /**
   * Despieces para compra real, por clave de slot que los consume (packing 1D
   * de barras del perfil). Opcional.
   */
  despieces?: Record<string, number[]>;
  /**
   * Traza rica para ficha técnica / OT / visor (layout de ojales, desarrollo
   * de cenefa, refuerzos). Opcional; el motor la adjunta a la ejecución.
   */
  traza?: Record<string, unknown>;
}

export type Derivador = (
  jobContext: JobContext,
  paramsEfectivos: Record<string, unknown>,
  /** Atributos de la variante del slot que la familia declaró en `derivadorMaterialSlot`. */
  materialPrincipal?: Record<string, unknown> | null,
) => ResultadoDerivador | null;

/** Clave reservada del JobContext: Record<configPasoId, ResultadoDerivador | null>. */
export const KEY_DERIVACIONES_POR_PASO = '__derivacionesPorPaso';

export type DerivacionesPorPaso = Record<string, ResultadoDerivador | null>;

/** Lee el cache de derivaciones del JobContext (puede no existir aún). */
export function derivacionesDelJobContext(
  jobContext: JobContext,
): DerivacionesPorPaso {
  const ctx = jobContext as Record<string, unknown>;
  const actual = ctx[KEY_DERIVACIONES_POR_PASO];
  if (actual && typeof actual === 'object') {
    return actual as DerivacionesPorPaso;
  }
  const nuevo: DerivacionesPorPaso = {};
  ctx[KEY_DERIVACIONES_POR_PASO] = nuevo;
  return nuevo;
}
