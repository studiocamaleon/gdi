/**
 * Post-procesamiento de imposición para talonarios.
 *
 * Toma un `ImposicionBase` (resultado del grid 2D del módulo de nesting)
 * y le agrega restricciones específicas del producto talonario:
 *  - `teteBeche`: poses enfrentadas para emblocado.
 *  - `puntilladoLineMm` y `puntilladoBorde`: posición de la línea de
 *    puntillado (ajustada al borde rotado si la imposición rotó la
 *    pieza 90° para aprovechar el pliego).
 *  - `encuadernacionTipo`: tipo de encuadernación usada.
 *
 * Ported (1:1) desde:
 *   motors/talonario.calculations.ts:applyTalonarioImposicionConstraints
 *
 * Ubicación en el módulo de nesting porque opera sobre el output de
 * imposición y es lógica geométrica (mapeo de bordes según rotación).
 */

// Tipos del talonario (extraídos del antiguo motor `motors/talonario.calculations.ts`
// que se eliminó en F.1.3). El motor universal por pasos los va a reusar.

export interface ImposicionBase {
  /** Cantidad de poses cuando se imprimen en orientación normal. */
  normal: number;
  /** Cantidad de poses cuando se imprimen rotadas 90°. */
  rotada: number;
  /** Orientación elegida para esta imposición. */
  orientacion: 'normal' | 'rotada';
  /** Cantidad de poses por pliego en la orientación elegida. */
  posesPorPliego: number;
  /** Otros campos del cálculo de imposición (libre, depende del nesting). */
  [key: string]: unknown;
}

export interface TalonarioMotorConfig {
  encuadernacion: {
    tipo: 'emblocado' | 'engrapado' | 'anillado' | string;
  };
  puntillado: {
    habilitado: boolean;
    borde?: 'superior' | 'inferior' | 'izquierdo' | 'derecho' | null;
    distanciaBordeMm?: number | null;
  };
}

export interface TalonarioImposicionResult extends ImposicionBase {
  /** Si la imposición es tete-beche (poses enfrentadas) — solo aplica para emblocado. */
  teteBeche: boolean;
  /** Posición de la línea de puntillado en mm desde el borde, o null si no aplica. */
  puntilladoLineMm: number | null;
  /** Borde donde va el puntillado en el render del pliego, ajustado por rotación. */
  puntilladoBorde: string | null;
  /** Tipo de encuadernación. */
  encuadernacionTipo: string;
}

/**
 * El borde del puntillado se define en la orientación ORIGINAL de la
 * pieza. Si la imposición rota la pieza 90° CW para aprovechar mejor el
 * pliego, mapeamos el borde original al borde del render/pliego.
 */
const ROTATED_BORDE_MAP: Record<string, string> = {
  superior: 'derecho',
  inferior: 'izquierdo',
  izquierdo: 'superior',
  derecho: 'inferior',
};

export function applyTalonarioImposicionConstraints(
  base: ImposicionBase,
  config: TalonarioMotorConfig,
): TalonarioImposicionResult {
  const teteBeche = config.encuadernacion.tipo === 'emblocado';

  const bordeOriginal = config.puntillado.borde ?? null;
  const bordeRender =
    base.orientacion === 'rotada' && bordeOriginal
      ? (ROTATED_BORDE_MAP[bordeOriginal] ?? bordeOriginal)
      : bordeOriginal;

  return {
    ...base,
    teteBeche,
    puntilladoLineMm: config.puntillado.habilitado
      ? Number(config.puntillado.distanciaBordeMm ?? 0)
      : null,
    puntilladoBorde: config.puntillado.habilitado ? bordeRender : null,
    encuadernacionTipo: config.encuadernacion.tipo,
  };
}
