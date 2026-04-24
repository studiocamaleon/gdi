/**
 * Evaluador de reglas JsonLogic.
 *
 * Wrappea la librería `json-logic-js` con un contrato seguro y manejo
 * uniforme de errores. Usado por:
 * - D.1 Activación CONDICIONAL de pasos
 * - D.2 Selección automática de perfil con regla
 * - D.5 Reglas de selección de material
 * - D.6 Activación CONDICIONAL de cargos directos
 *
 * Ver `docs/motor-por-pasos-analisis/05-resoluciones-por-paso.md`.
 */

import jsonLogic from 'json-logic-js';

export interface ResultadoEvaluacion {
  /** Resultado boolean de la regla. */
  resultado: boolean;
  /** Si hubo error al evaluar (regla mal formada, dato faltante, etc.). */
  error?: string;
  /** Detalles del intento de evaluación. */
  detalle?: {
    regla: unknown;
    contexto: Record<string, unknown>;
    valorCrudo: unknown;
  };
}

/**
 * Evalúa una regla JsonLogic contra un contexto y devuelve un resultado boolean.
 *
 * - Si `regla` es null/undefined o un objeto vacío → devuelve true (sin restricciones).
 * - Si la evaluación devuelve un valor que no es boolean, se aplica coerción
 *   (truthy → true, falsy → false) para evitar exceptions.
 * - Si la evaluación lanza error, lo capturamos y devolvemos `resultado: false` + `error`.
 */
export function evaluarRegla(
  regla: unknown,
  contexto: Record<string, unknown>,
): ResultadoEvaluacion {
  if (regla === null || regla === undefined) {
    return { resultado: true };
  }
  if (typeof regla === 'object' && regla !== null && Object.keys(regla).length === 0) {
    return { resultado: true };
  }

  try {
    const valor = jsonLogic.apply(regla as never, contexto);
    return {
      resultado: Boolean(valor),
      detalle: { regla, contexto, valorCrudo: valor },
    };
  } catch (err) {
    return {
      resultado: false,
      error: err instanceof Error ? err.message : String(err),
      detalle: { regla, contexto, valorCrudo: undefined },
    };
  }
}

/**
 * Wrapper para devolver solo el boolean. Útil cuando no necesitás detalle.
 * Si hay error o la regla es nula, asume true por defecto (lado seguro).
 */
export function evaluarReglaBoolean(
  regla: unknown,
  contexto: Record<string, unknown>,
  defaultIfError = false,
): boolean {
  const r = evaluarRegla(regla, contexto);
  if (r.error) return defaultIfError;
  return r.resultado;
}
