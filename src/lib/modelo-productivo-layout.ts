export type TipoNodoProductivoVisual = "PASO" | "ETAPA" | "COMPONENTE";

export type NodoProductivoVisual = {
  clave: string;
  tipo: TipoNodoProductivoVisual;
  orden: number;
};

export type AristaProductivaVisual = {
  desdeClave: string;
  haciaClave: string;
};

export type DestinoNodoProductivo =
  | { tipo: "PARALELO"; columna: number }
  | { tipo: "SECUENCIAL"; posicion: number };

/**
 * Proyecta las dependencias del modelo completo sobre los nodos que participan
 * en una vista o ejecución concreta. Cuando un nodo intermedio está omitido,
 * conecta cada ancestro activo con el primer descendiente activo alcanzable.
 *
 * Ejemplo: A → omitido → B se convierte en A → B. Filtrar solamente las
 * aristas dejaría a B como una raíz falsa y el layout lo mostraría en paralelo.
 */
export function reducirAristasProductivas(
  aristas: AristaProductivaVisual[],
  clavesActivas: Set<string>,
): AristaProductivaVisual[] {
  const salientes = new Map<string, string[]>();
  for (const arista of aristas) {
    if (arista.desdeClave === arista.haciaClave) continue;
    salientes.set(arista.desdeClave, [
      ...(salientes.get(arista.desdeClave) ?? []),
      arista.haciaClave,
    ]);
  }

  const reducidas: AristaProductivaVisual[] = [];
  for (const desdeClave of clavesActivas) {
    const pendientes = [...(salientes.get(desdeClave) ?? [])];
    const visitados = new Set<string>();
    while (pendientes.length > 0) {
      const haciaClave = pendientes.shift()!;
      if (visitados.has(haciaClave)) continue;
      visitados.add(haciaClave);
      if (clavesActivas.has(haciaClave)) {
        reducidas.push({ desdeClave, haciaClave });
      } else {
        pendientes.push(...(salientes.get(haciaClave) ?? []));
      }
    }
  }
  return reducidas;
}

/**
 * Proyecta un DAG en momentos productivos. Los nodos de una misma columna
 * pueden ejecutarse en paralelo; las columnas avanzan de izquierda a derecha.
 */
export function construirColumnasProductivas<T extends NodoProductivoVisual>(
  nodos: T[],
  aristas: AristaProductivaVisual[],
): T[][] {
  if (!nodos.length) return [];

  const porClave = new Map(nodos.map((nodo) => [nodo.clave, nodo]));
  const entrantes = new Map(nodos.map((nodo) => [nodo.clave, 0]));
  const salientes = new Map(nodos.map((nodo) => [nodo.clave, [] as string[]]));
  const niveles = new Map(nodos.map((nodo) => [nodo.clave, 0]));

  for (const arista of aristas) {
    if (
      arista.desdeClave === arista.haciaClave ||
      !porClave.has(arista.desdeClave) ||
      !porClave.has(arista.haciaClave)
    ) {
      continue;
    }
    const destinos = salientes.get(arista.desdeClave)!;
    if (destinos.includes(arista.haciaClave)) continue;
    destinos.push(arista.haciaClave);
    entrantes.set(
      arista.haciaClave,
      (entrantes.get(arista.haciaClave) ?? 0) + 1,
    );
  }

  const ordenar = (claves: string[]) =>
    claves.sort(
      (a, b) => (porClave.get(a)?.orden ?? 0) - (porClave.get(b)?.orden ?? 0),
    );
  const disponibles = ordenar(
    nodos
      .filter((nodo) => (entrantes.get(nodo.clave) ?? 0) === 0)
      .map((nodo) => nodo.clave),
  );
  const procesados = new Set<string>();

  while (disponibles.length) {
    const clave = disponibles.shift()!;
    if (procesados.has(clave)) continue;
    procesados.add(clave);
    for (const destino of salientes.get(clave) ?? []) {
      niveles.set(
        destino,
        Math.max(niveles.get(destino) ?? 0, (niveles.get(clave) ?? 0) + 1),
      );
      const restantes = (entrantes.get(destino) ?? 0) - 1;
      entrantes.set(destino, restantes);
      if (restantes === 0) {
        disponibles.push(destino);
        ordenar(disponibles);
      }
    }
  }

  // Un borrador antiguo puede contener una referencia circular o incompleta.
  // No ocultamos esos nodos: los ubicamos al final para que el usuario pueda
  // corregir la vía desde la interfaz.
  let nivelFallback = Math.max(0, ...niveles.values()) + 1;
  for (const nodo of [...nodos].sort((a, b) => a.orden - b.orden)) {
    if (procesados.has(nodo.clave)) continue;
    niveles.set(nodo.clave, nivelFallback);
    nivelFallback += 1;
  }

  const columnas = new Map<number, T[]>();
  for (const nodo of nodos) {
    const nivel = niveles.get(nodo.clave) ?? 0;
    columnas.set(nivel, [...(columnas.get(nivel) ?? []), nodo]);
  }

  return [...columnas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, columna]) => columna.sort((a, b) => a.orden - b.orden));
}

export function moverNodoProductivo(
  columnas: string[][],
  nodoClave: string,
  destino: DestinoNodoProductivo,
): string[][] {
  const sinNodo = columnas
    .map((columna) => columna.filter((clave) => clave !== nodoClave))
    .filter((columna) => columna.length > 0);

  if (destino.tipo === "PARALELO") {
    const indice = Math.max(0, Math.min(destino.columna, sinNodo.length - 1));
    if (!sinNodo.length) return [[nodoClave]];
    return sinNodo.map((columna, columnaIndex) =>
      columnaIndex === indice ? [...columna, nodoClave] : columna,
    );
  }

  const posicion = Math.max(0, Math.min(destino.posicion, sinNodo.length));
  return [
    ...sinNodo.slice(0, posicion),
    [nodoClave],
    ...sinNodo.slice(posicion),
  ];
}

/** Agrega un nodo nuevo sin alterar los nodos que ya forman la vía. */
export function insertarNodoProductivo(
  columnas: string[][],
  nodoClave: string,
  destino: DestinoNodoProductivo,
): string[][] {
  const siguientes = columnas.map((columna) => [...columna]);
  if (destino.tipo === "PARALELO") {
    const indice = Math.max(
      0,
      Math.min(destino.columna, siguientes.length - 1),
    );
    if (!siguientes.length) return [[nodoClave]];
    siguientes[indice].push(nodoClave);
    return siguientes;
  }

  const posicion = Math.max(0, Math.min(destino.posicion, siguientes.length));
  siguientes.splice(posicion, 0, [nodoClave]);
  return siguientes;
}

/**
 * Sustituye un nodo sin cambiar el momento ni la rama que ocupa. Las aristas
 * se vuelven a calcular desde estas columnas por el editor del modelo.
 */
export function reemplazarNodoProductivo(
  columnas: string[][],
  nodoAnteriorClave: string,
  nodoNuevoClave: string,
): string[][] {
  if (nodoAnteriorClave === nodoNuevoClave) {
    return columnas.map((columna) => [...columna]);
  }

  return columnas
    .map((columna) =>
      columna
        .filter((clave) => clave !== nodoNuevoClave)
        .map((clave) => (clave === nodoAnteriorClave ? nodoNuevoClave : clave)),
    )
    .filter((columna) => columna.length > 0);
}
