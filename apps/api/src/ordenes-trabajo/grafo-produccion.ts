export type TopologiaProduccion = 'LINEAL' | 'DAG';

export type NodoGrafoProduccion = {
  clave: string;
  indice: number;
  gates?: TipoGateOperativo[];
};

export type TipoGateOperativo = 'MATERIAL' | 'CALIDAD';

export type AristaGrafoProduccion = {
  desdeClave: string;
  haciaClave: string;
};

export type GrafoProduccion = {
  topologia: TopologiaProduccion;
  nodos: NodoGrafoProduccion[];
  aristas: AristaGrafoProduccion[];
  raices: string[];
  terminales: string[];
};

export type EstadoNodoGrafo = {
  clave: string;
  estado: string;
};

function clavesUnicas(nodos: NodoGrafoProduccion[]) {
  const claves = new Set<string>();
  for (const nodo of nodos) {
    const clave = nodo.clave.trim();
    if (!clave) throw new Error('Todo nodo productivo debe tener una clave.');
    if (claves.has(clave)) {
      throw new Error(`La clave de nodo "${clave}" está duplicada.`);
    }
    claves.add(clave);
  }
  return claves;
}

export function validarYOrdenarGrafo(
  nodosEntrada: NodoGrafoProduccion[],
  aristasEntrada: AristaGrafoProduccion[],
): GrafoProduccion {
  const claves = clavesUnicas(nodosEntrada);
  const nodos = [...nodosEntrada]
    .map((nodo) => ({
      ...nodo,
      clave: nodo.clave.trim(),
      gates: [...new Set(nodo.gates ?? [])].sort(),
    }))
    .sort((a, b) => a.indice - b.indice || a.clave.localeCompare(b.clave));
  const indicePorClave = new Map(
    nodos.map((nodo) => [nodo.clave, nodo.indice]),
  );
  const vistas = new Set<string>();
  const aristas = aristasEntrada
    .map((arista) => ({
      desdeClave: arista.desdeClave.trim(),
      haciaClave: arista.haciaClave.trim(),
    }))
    .sort(
      (a, b) =>
        (indicePorClave.get(a.desdeClave) ?? Number.MAX_SAFE_INTEGER) -
          (indicePorClave.get(b.desdeClave) ?? Number.MAX_SAFE_INTEGER) ||
        (indicePorClave.get(a.haciaClave) ?? Number.MAX_SAFE_INTEGER) -
          (indicePorClave.get(b.haciaClave) ?? Number.MAX_SAFE_INTEGER),
    );
  const entrantes = new Map(nodos.map((nodo) => [nodo.clave, 0]));
  const salientes = new Map(nodos.map((nodo) => [nodo.clave, [] as string[]]));

  for (const arista of aristas) {
    if (!claves.has(arista.desdeClave) || !claves.has(arista.haciaClave)) {
      throw new Error(
        `La dependencia ${arista.desdeClave} → ${arista.haciaClave} referencia un nodo inexistente.`,
      );
    }
    if (arista.desdeClave === arista.haciaClave) {
      throw new Error(
        `El nodo "${arista.desdeClave}" no puede depender de sí mismo.`,
      );
    }
    const firma = `${arista.desdeClave}\u0000${arista.haciaClave}`;
    if (vistas.has(firma)) {
      throw new Error(
        `La dependencia ${arista.desdeClave} → ${arista.haciaClave} está duplicada.`,
      );
    }
    vistas.add(firma);
    entrantes.set(
      arista.haciaClave,
      (entrantes.get(arista.haciaClave) ?? 0) + 1,
    );
    salientes.get(arista.desdeClave)!.push(arista.haciaClave);
  }

  const cola = nodos
    .filter((nodo) => entrantes.get(nodo.clave) === 0)
    .map((nodo) => nodo.clave);
  let visitados = 0;
  for (let cursor = 0; cursor < cola.length; cursor += 1) {
    const clave = cola[cursor];
    visitados += 1;
    for (const siguiente of salientes.get(clave) ?? []) {
      const restantes = (entrantes.get(siguiente) ?? 0) - 1;
      entrantes.set(siguiente, restantes);
      if (restantes === 0) cola.push(siguiente);
    }
  }
  if (visitados !== nodos.length) {
    throw new Error('La topología productiva contiene un ciclo.');
  }

  const nodoPorClave = new Map(nodos.map((nodo) => [nodo.clave, nodo]));
  const nodosTopologicos = cola.map((clave, indice) => ({
    ...nodoPorClave.get(clave)!,
    indice,
  }));
  const conEntrantes = new Set(aristas.map((arista) => arista.haciaClave));
  const conSalientes = new Set(aristas.map((arista) => arista.desdeClave));
  return {
    topologia: esLineal(nodosTopologicos, aristas) ? 'LINEAL' : 'DAG',
    nodos: nodosTopologicos,
    aristas,
    raices: nodosTopologicos
      .filter((nodo) => !conEntrantes.has(nodo.clave))
      .map((nodo) => nodo.clave),
    terminales: nodosTopologicos
      .filter((nodo) => !conSalientes.has(nodo.clave))
      .map((nodo) => nodo.clave),
  };
}

function esLineal(
  nodos: NodoGrafoProduccion[],
  aristas: AristaGrafoProduccion[],
) {
  if (nodos.length <= 1) return aristas.length === 0;
  if (aristas.length !== nodos.length - 1) return false;
  return nodos
    .slice(1)
    .every((nodo, index) =>
      aristas.some(
        (arista) =>
          arista.desdeClave === nodos[index].clave &&
          arista.haciaClave === nodo.clave,
      ),
    );
}

export function compilarRutaLineal(
  nodosEntrada: NodoGrafoProduccion[],
): GrafoProduccion {
  const nodos = [...nodosEntrada].sort(
    (a, b) => a.indice - b.indice || a.clave.localeCompare(b.clave),
  );
  return validarYOrdenarGrafo(
    nodos,
    nodos.slice(1).map((nodo, index) => ({
      desdeClave: nodos[index].clave,
      haciaClave: nodo.clave,
    })),
  );
}

/**
 * Proyecta una receta sobre los pasos realmente activados por la cotización.
 * Si un opcional intermedio no participa, conecta sus ancestros con el primer
 * descendiente activo para no cortar la ruta ejecutable.
 */
export function reducirGrafoAClaves(
  grafo: GrafoProduccion,
  clavesActivas: Set<string>,
): GrafoProduccion {
  const nodos = grafo.nodos.filter((nodo) => clavesActivas.has(nodo.clave));
  const salientes = new Map<string, string[]>();
  for (const arista of grafo.aristas) {
    const lista = salientes.get(arista.desdeClave) ?? [];
    lista.push(arista.haciaClave);
    salientes.set(arista.desdeClave, lista);
  }
  const aristas: AristaGrafoProduccion[] = [];
  for (const nodo of nodos) {
    const pendientes = [...(salientes.get(nodo.clave) ?? [])];
    const visitados = new Set<string>();
    while (pendientes.length > 0) {
      const siguiente = pendientes.shift()!;
      if (visitados.has(siguiente)) continue;
      visitados.add(siguiente);
      if (clavesActivas.has(siguiente)) {
        aristas.push({ desdeClave: nodo.clave, haciaClave: siguiente });
      } else {
        pendientes.push(...(salientes.get(siguiente) ?? []));
      }
    }
  }
  return validarYOrdenarGrafo(nodos, aristas);
}

export function nodoEjecutable(
  clave: string,
  estados: EstadoNodoGrafo[],
  aristas: AristaGrafoProduccion[],
) {
  const porClave = new Map(estados.map((nodo) => [nodo.clave, nodo.estado]));
  return aristas
    .filter((arista) => arista.haciaClave === clave)
    .every((arista) => porClave.get(arista.desdeClave) === 'hecho');
}

export function nodoReabrible(
  clave: string,
  estados: EstadoNodoGrafo[],
  aristas: AristaGrafoProduccion[],
) {
  const porClave = new Map(estados.map((nodo) => [nodo.clave, nodo.estado]));
  const siguientes = new Map<string, string[]>();
  for (const arista of aristas) {
    const lista = siguientes.get(arista.desdeClave) ?? [];
    lista.push(arista.haciaClave);
    siguientes.set(arista.desdeClave, lista);
  }
  const pendientes = [...(siguientes.get(clave) ?? [])];
  const visitados = new Set<string>();
  while (pendientes.length) {
    const descendiente = pendientes.pop()!;
    if (visitados.has(descendiente)) continue;
    visitados.add(descendiente);
    if (porClave.get(descendiente) !== 'pendiente') return false;
    pendientes.push(...(siguientes.get(descendiente) ?? []));
  }
  return true;
}
