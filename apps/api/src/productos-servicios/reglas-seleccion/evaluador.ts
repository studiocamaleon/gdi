/**
 * A.5 — Evaluador de expresiones JsonLogic para ReglaDeSeleccion.
 *
 * Wrapper fino sobre json-logic-js con tipos TS útiles. Usado por el motor
 * de reglas para evaluar condiciones contra el Job Context + outputs previos.
 *
 * Ver documentación del DSL: https://jsonlogic.com/operations.html
 *
 * Operadores soportados (subset común):
 *   Comparación: ==, ===, !=, !==, <, <=, >, >=
 *   Lógicos:     and, or, !
 *   Condicional: if (equivalente a ternario: if[cond, then, else, cond2, then2, ...])
 *   Variables:   var (lookup de una ruta anidada, ej. { "var": "componente.letras.cantidad" })
 *   Colecciones: in, all, some, none, merge
 *   Aritméticos: +, -, *, /, %, min, max
 *   Misc:        missing, missing_some
 */
import jsonLogic from 'json-logic-js';

/**
 * Expresión JsonLogic. Usamos `unknown` en vez del tipo estricto porque el
 * DSL es dinámico. Las reglas persistidas se validan con Zod/class-validator
 * al escribirlas (en Etapa posterior).
 */
export type JsonLogicExpr = unknown;

/**
 * Contexto de evaluación: un objeto plano (o anidado) cuyos valores son
 * consumidos por `var` dentro de la expresión.
 *
 * En el motor v2, el contexto tendrá al menos:
 *   - Las variables del Job Context (cantidad, colores, caras, medidas, ...)
 *   - Los outputs canónicos de pasos previos (piezasPorPlaca, hojasImpresas, ...)
 *   - Parámetros del producto/variante accesibles por la regla.
 */
export type EvalContext = Record<string, unknown>;

/**
 * Evalúa una expresión JsonLogic contra un contexto.
 *
 * @returns el valor de la expresión (boolean para condiciones, any para decisiones).
 * @throws si la expresión es malformada.
 */
export function evaluarCondicion(expr: JsonLogicExpr, context: EvalContext): unknown {
  // json-logic-js acepta cualquier JSON-like. El cast unknown → any es seguro
  // porque la lib valida su propia estructura y tira TypeError si es inválida.
  return jsonLogic.apply(expr as any, context);
}

/**
 * Azúcar para cuando la expresión debe devolver boolean (ej. condiciones
 * de activación de un paso o filtros de casos de ReglaDeSeleccion).
 *
 * Cualquier valor truthy se considera true; un error en evaluación se propaga.
 */
export function evaluarBool(expr: JsonLogicExpr, context: EvalContext): boolean {
  return Boolean(evaluarCondicion(expr, context));
}

/**
 * Evalúa los `casos` de una ReglaDeSeleccion contra el contexto. Retorna la
 * decisión del primer caso cuya condición matchee, o `defaultDecision` si
 * ninguno matchea y está definido, o `undefined` si no hay default.
 *
 * Los casos se recorren en el orden del array (primer match gana).
 */
export type ReglaCaso = {
  condicion: JsonLogicExpr;
  decision: unknown;
};

export function resolverRegla(
  casos: ReglaCaso[],
  defaultDecision: unknown,
  context: EvalContext,
): unknown {
  for (const caso of casos) {
    if (evaluarBool(caso.condicion, context)) {
      return caso.decision;
    }
  }
  return defaultDecision;
}
