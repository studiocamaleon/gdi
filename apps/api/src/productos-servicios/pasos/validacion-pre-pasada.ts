/**
 * Guardas de las familias que mutan medidas en la PRE-PASADA.
 *
 * Esas familias se resuelven antes del bucle, cuando todavía no corrió ningún
 * paso. Por eso no pueden depender de nada que publique un paso anterior:
 *
 *  - `HEREDAR_DEL_OUTPUT_CANONICO` ya está cerrado por
 *    `mecanismosCantidadSoportados` (el backend rechaza con 400).
 *  - Falta cerrar la regla CONDICIONAL: su JsonLogic lee el JobContext, donde
 *    también viven los outputs canónicos. Una regla que mire
 *    `pliegos_calculados` daría FALSO en la pre-pasada —el output no existe
 *    todavía— y el refuerzo no se aplicaría, en silencio.
 *
 * Una regla sobre datos del comercial ("si uso = exterior, reforzar") es
 * segura: esos valores están en el JobContext desde el principio.
 *
 * Ver docs/modificaciones-fisicas-lona-diseno.md
 */
import { FAMILIAS } from './familias';

/**
 * Todos los outputs canónicos que alguna familia declara. Es el conjunto que
 * una regla de pre-pasada NO puede mirar.
 */
export function outputsCanonicosConocidos(): Set<string> {
  const outputs = new Set<string>();
  for (const familia of Object.values(FAMILIAS)) {
    for (const output of familia.outputsCanonicos ?? []) outputs.add(output);
  }
  return outputs;
}

/**
 * Nombres de variable que referencia una regla JsonLogic, en cualquier nivel.
 * JsonLogic las expresa como `{ "var": "nombre" }`.
 */
export function variablesDeRegla(regla: unknown): string[] {
  const encontradas: string[] = [];

  const visitar = (nodo: unknown): void => {
    if (Array.isArray(nodo)) {
      nodo.forEach(visitar);
      return;
    }
    if (!nodo || typeof nodo !== 'object') return;

    for (const [clave, valor] of Object.entries(nodo as Record<string, unknown>)) {
      if (clave === 'var') {
        // `{var: "x"}` o `{var: ["x", default]}`.
        if (typeof valor === 'string') encontradas.push(valor);
        else if (Array.isArray(valor) && typeof valor[0] === 'string') {
          encontradas.push(valor[0]);
        }
        continue;
      }
      visitar(valor);
    }
  };

  visitar(regla);
  return encontradas;
}

/**
 * Outputs canónicos que referencia la regla. Vacío = la regla es segura para
 * evaluarse en la pre-pasada.
 *
 * Compara también el prefijo antes del punto: JsonLogic permite rutas como
 * `pliegos_calculados.total`.
 */
export function outputsReferenciadosPorRegla(
  regla: unknown,
  outputs: Set<string> = outputsCanonicosConocidos(),
): string[] {
  const referenciados = new Set<string>();
  for (const variable of variablesDeRegla(regla)) {
    const raiz = variable.split('.')[0];
    if (outputs.has(variable)) referenciados.add(variable);
    else if (outputs.has(raiz)) referenciados.add(raiz);
  }
  return Array.from(referenciados);
}
