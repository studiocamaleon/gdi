/** Formato de transporte/persistencia, sin dependencias de Node ni de Nest.
 * Cada estructura idéntica se escribe una vez. No redondea coordenadas, no
 * referencia cachés externas y conserva el JSON histórico de forma autónoma.
 * También lo usa el cliente web para decodificar respuestas negociadas.
 */
export const FORMATO_JSON_COMPARTIDO = 'grafo-json-dag';
type Valor = null | boolean | number | string | { r: number };
type Punto = { x: number; y: number };
type Nodo = [0, Valor[]] | [1, Array<[string, Valor]>] | [2, Punto[]];
export type JsonCompartido = {
  formato: typeof FORMATO_JSON_COMPARTIDO;
  version: 1;
  raiz: Valor;
  nodos: Nodo[];
};

export function esJsonCompartido(valor: unknown): valor is JsonCompartido {
  return (
    !!valor &&
    typeof valor === 'object' &&
    (valor as JsonCompartido).formato === FORMATO_JSON_COMPARTIDO &&
    (valor as JsonCompartido).version === 1 &&
    Array.isArray((valor as JsonCompartido).nodos)
  );
}

/** Deja los documentos pequeños tal cual. El umbral se calcula sin crear
 * antes una cadena con decenas de MB. La tabla es local a cada documento. */
export function compactarJson(valor: unknown): unknown {
  if (esJsonCompartido(valor) || !jsonEsGrande(valor)) return valor;
  const nodos: Nodo[] = [];
  const indices = new Map<string, number>();
  const activos = new WeakSet<object>();
  let tamanoOriginal = 0;
  const visitar = (v: unknown): Valor => {
    if (v === null || v === undefined) {
      tamanoOriginal += 4;
      return null;
    }
    if (typeof v !== 'object') {
      const scalar = typeof v === 'number' && !Number.isFinite(v) ? null : v;
      if (
        !['string', 'boolean', 'number'].includes(typeof scalar) &&
        scalar !== null
      )
        throw new Error('El snapshot debe ser serializable como JSON.');
      tamanoOriginal += JSON.stringify(scalar).length;
      return scalar as Valor;
    }
    if ('toJSON' in v && typeof v.toJSON === 'function')
      return visitar(v.toJSON());
    // Un contorno es una hoja numérica. Serializar sus puntos de una vez
    // evita millones de entradas de diccionario para las copias de una pieza.
    if (
      Array.isArray(v) &&
      v.length > 2 &&
      v.every(
        (p: unknown) =>
          !!p &&
          typeof p === 'object' &&
          Object.keys(p).length === 2 &&
          typeof (p as Punto).x === 'number' &&
          typeof (p as Punto).y === 'number' &&
          Number.isFinite((p as Punto).x) &&
          Number.isFinite((p as Punto).y),
      )
    ) {
      const nodo: Nodo = [2, v];
      const firma = JSON.stringify(nodo);
      tamanoOriginal += firma.length - 4;
      let indice = indices.get(firma);
      if (indice === undefined) {
        indice = nodos.length;
        nodos.push(nodo);
        indices.set(firma, indice);
      }
      return { r: indice };
    }
    if (activos.has(v))
      throw new Error('El snapshot contiene referencias circulares.');
    activos.add(v);
    tamanoOriginal += 2;
    const nodo: Nodo = Array.isArray(v)
      ? [
          0,
          v.map((item) => {
            tamanoOriginal++;
            return visitar(item);
          }),
        ]
      : [
          1,
          Object.entries(v)
            .filter(([, item]) => item !== undefined)
            .map(([key, item]) => {
              tamanoOriginal += JSON.stringify(key).length + 2;
              return [key, visitar(item)] as [string, Valor];
            }),
        ];
    activos.delete(v);
    const firma = JSON.stringify(nodo);
    let indice = indices.get(firma);
    if (indice === undefined) {
      indice = nodos.length;
      nodos.push(nodo);
      indices.set(firma, indice);
    }
    return { r: indice };
  };
  const raiz = visitar(valor);
  const compacto: JsonCompartido = {
    formato: FORMATO_JSON_COMPARTIDO,
    version: 1,
    raiz,
    nodos,
  };
  return JSON.stringify(compacto).length < tamanoOriginal * 0.75
    ? compacto
    : valor;
}

export function jsonEsGrande(valor: unknown): boolean {
  let restante = 64 * 1024;
  const activos = new WeakSet<object>();
  const visitar = (v: unknown): void => {
    if (restante <= 0 || v == null) return;
    if (typeof v !== 'object') {
      restante -= typeof v === 'string' ? v.length + 2 : 8;
      return;
    }
    if (activos.has(v))
      throw new Error('El snapshot contiene referencias circulares.');
    activos.add(v);
    for (const [key, item] of Object.entries(v)) {
      restante -= key.length + 4;
      visitar(item);
      if (restante <= 0) break;
    }
    activos.delete(v);
  };
  visitar(valor);
  return restante <= 0;
}

/** Restaura copias independientes: editar una pose no puede modificar otra
 * por compartir identidad de objeto. Acepta documentos históricos sin codec.
 * Las referencias sólo apuntan hacia atrás, evitando ciclos y recursión
 * controlada por una tabla corrupta. No se acepta el formato como input HTTP.
 */
export function restaurarJson<T = unknown>(valor: unknown): T {
  if (!esJsonCompartido(valor)) return valor as T;
  const nodos = valor.nodos;
  const visitar = (v: Valor, limite: number, profundidad: number): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (profundidad > 200 || !Number.isInteger(v.r) || v.r < 0 || v.r >= limite)
      throw new Error('Referencia inválida en el snapshot compartido.');
    const nodo = nodos[v.r];
    if (!Array.isArray(nodo) || !Array.isArray(nodo[1]))
      throw new Error('Nodo inválido en el snapshot compartido.');
    if (nodo[0] === 2) return nodo[1].map((p) => ({ ...p }));
    if (nodo[0] === 0)
      return nodo[1].map((item) => visitar(item, v.r, profundidad + 1));
    if (nodo[0] !== 1)
      throw new Error('Tipo inválido en el snapshot compartido.');
    return Object.fromEntries(
      nodo[1].map(([key, item]) => [key, visitar(item, v.r, profundidad + 1)]),
    );
  };
  return visitar(valor.raiz, nodos.length, 0) as T;
}

/** Acceso diferido a una geometría: no expande el resto del documento. Cada
 * lectura entrega una copia independiente del diccionario inmutable. */
export function restaurarElementoJson(valor: unknown, indice: number): unknown {
  if (!Number.isInteger(indice) || indice < 0)
    throw new Error('Índice geométrico inválido.');
  if (!esJsonCompartido(valor)) {
    if (!Array.isArray(valor) || indice >= valor.length)
      throw new Error('Índice geométrico inválido.');
    return JSON.parse(JSON.stringify(valor[indice]));
  }
  const raiz = valor.raiz;
  const nodo = raiz && typeof raiz === 'object' ? valor.nodos[raiz.r] : null;
  if (!nodo || nodo[0] !== 0 || indice >= nodo[1].length)
    throw new Error('Índice geométrico inválido.');
  return restaurarJson({ ...valor, raiz: nodo[1][indice] });
}

/** Metadatos del job (por ejemplo exitoso) sin expandir el plano para un log. */
export function leerPropiedadJson(valor: unknown, clave: string): unknown {
  if (!esJsonCompartido(valor))
    return valor && typeof valor === 'object'
      ? (valor as Record<string, unknown>)[clave]
      : undefined;
  const raiz = valor.raiz;
  const nodo = raiz && typeof raiz === 'object' ? valor.nodos[raiz.r] : null;
  if (!nodo || nodo[0] !== 1) return undefined;
  const propiedad = nodo[1].find(([k]) => k === clave);
  return propiedad
    ? restaurarJson({ ...valor, raiz: propiedad[1] })
    : undefined;
}
