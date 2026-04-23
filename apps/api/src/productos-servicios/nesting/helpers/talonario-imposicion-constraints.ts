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

// Re-exportamos los tipos desde el archivo legacy para no duplicarlos.
// Cuando se migre el resto a tipos universales, esto se cleanup.
import type { ImposicionBase, TalonarioMotorConfig, TalonarioImposicionResult } from '../../motors/talonario.calculations';

export type { ImposicionBase, TalonarioMotorConfig, TalonarioImposicionResult };

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
