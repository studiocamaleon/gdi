/**
 * Resolución de la medida "Plancha completa" (tipo `pliego_util`): la pieza
 * se DERIVA del pliego del paso de impresión — área útil = pliego − márgenes.
 *
 * ESPEJO de la resolución de márgenes del motor
 * (`apps/api/src/motor-universal/nesting-config.ts`, `baseMargins` + extras):
 * por lado gana el primero definido de
 *   override del paso (nestingConfig.margins) →
 *   legacy en la raíz de params (izq/der/sup/inf) →
 *   máquina (margenesNoImprimiblesMm, con default de familia 5 mm) →
 *   0
 * y al resultado se le SUMAN extraMargins + pieceBleedMm (sangrado).
 * Mismo criterio que `nesting-compra-pliego.ts`: si esta cuenta diverge del
 * motor, es un bug de este helper (cubierto por `medida-plancha.test.ts`).
 *
 * Ver docs/medida-plancha-area-util-diseno.md.
 */

/** Default de familia para impresion_por_hoja (pinza y borde no imprimible).
 *  Espejo de `margenesNestingDefault` en familias.ts — si allá cambia, acá
 *  también (el test lo recuerda). */
const MARGEN_DEFAULT_IMPRESION_HOJA_MM = 5;

function num(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function rec(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export interface ResolverPlanchaInput {
  /** Dimensiones del pliego (variante activa del papel), en mm. */
  pliegoAnchoMm: number;
  pliegoAltoMm: number;
  /** `parametrosTecnicosJson` de la máquina activa del paso de impresión. */
  maquinaParametrosTecnicos?: Record<string, unknown> | null;
  /** `paramsPasoJson` del paso de impresión (overrides de nesting). */
  pasoParams?: Record<string, unknown> | null;
}

export interface PlanchaResuelta {
  anchoMm: number;
  altoMm: number;
  margenes: { leftMm: number; rightMm: number; topMm: number; bottomMm: number };
}

export function resolverPlanchaUtil(
  input: ResolverPlanchaInput,
): PlanchaResuelta | null {
  const pliegoAncho = num(input.pliegoAnchoMm) ?? 0;
  const pliegoAlto = num(input.pliegoAltoMm) ?? 0;
  if (pliegoAncho <= 0 || pliegoAlto <= 0) return null;

  const maqParams = rec(input.maquinaParametrosTecnicos);
  const maquina = rec(maqParams.margenesNoImprimiblesMm);
  const maquinaUniforme = num(
    maqParams.margenNoImprimibleMm,
    maqParams.margenNoImprimible,
  );

  const params = rec(input.pasoParams);
  const nestingConfig = rec(params.nestingConfig);
  const override = rec(nestingConfig.margins);
  const extra = rec(nestingConfig.extraMargins);
  const bleed = num(nestingConfig.pieceBleedMm) ?? 0;

  const lado = (
    overrideKeys: unknown[],
    legacyKeys: unknown[],
    maquinaKeys: unknown[],
    extraKeys: unknown[],
  ) => {
    const base =
      num(...overrideKeys) ??
      num(...legacyKeys) ??
      num(...maquinaKeys, maquinaUniforme) ??
      MARGEN_DEFAULT_IMPRESION_HOJA_MM;
    return Math.max(0, base) + Math.max(0, num(...extraKeys) ?? 0) + bleed;
  };

  const margenes = {
    leftMm: lado(
      [override.leftMm, override.izq, override.izquierdo],
      [params.leftMm, params.izq, params.izquierdo],
      [maquina.leftMm, maquina.izq, maquina.izquierdo, maquina.left],
      [extra.leftMm, extra.izq],
    ),
    rightMm: lado(
      [override.rightMm, override.der, override.derecho],
      [params.rightMm, params.der, params.derecho],
      [maquina.rightMm, maquina.der, maquina.derecho, maquina.right],
      [extra.rightMm, extra.der],
    ),
    topMm: lado(
      [override.topMm, override.sup],
      [params.topMm, params.sup],
      [maquina.topMm, maquina.sup, maquina.top],
      [extra.topMm, extra.sup],
    ),
    bottomMm: lado(
      [override.bottomMm, override.inf],
      [params.bottomMm, params.inf],
      [maquina.bottomMm, maquina.inf, maquina.bottom],
      [extra.bottomMm, extra.inf],
    ),
  };

  const anchoMm = pliegoAncho - margenes.leftMm - margenes.rightMm;
  const altoMm = pliegoAlto - margenes.topMm - margenes.bottomMm;
  if (anchoMm <= 0 || altoMm <= 0) return null;
  return { anchoMm, altoMm, margenes };
}
