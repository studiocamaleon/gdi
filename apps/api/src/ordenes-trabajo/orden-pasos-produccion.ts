/** Orden de presentación: las dependencias prevalecen sobre el índice de costeo.
 * No cambia índices, estados ni permisos; las referencias a otros ítems siguen
 * siendo requisitos de ejecución, aunque no estén en esta lista.
 */
export function ordenarPasosProduccion<
  T extends { id: string; indice: number },
>(
  pasos: readonly T[],
  predecesores: (paso: T) => readonly string[],
  ordenBase: 'indice' | 'entrada' = 'indice',
): T[] {
  const posiciones = new Map(pasos.map((p, i) => [p.id, i]));
  const comparar = (a: T, b: T) =>
    ordenBase === 'entrada'
      ? posiciones.get(a.id)! - posiciones.get(b.id)!
      : a.indice - b.indice || a.id.localeCompare(b.id);
  const porIndice = [...pasos].sort(comparar);
  const porId = new Map(porIndice.map((p) => [p.id, p]));
  const pendientes = new Map<string, number>();
  const siguientes = new Map<string, string[]>();
  for (const paso of porIndice) {
    const previos = new Set(predecesores(paso).filter((id) => porId.has(id)));
    pendientes.set(paso.id, previos.size);
    for (const id of previos) {
      const lista = siguientes.get(id) ?? [];
      lista.push(paso.id);
      siguientes.set(id, lista);
    }
  }
  const disponibles = porIndice.filter((p) => pendientes.get(p.id) === 0);
  const resultado: T[] = [];
  while (disponibles.length) {
    disponibles.sort(comparar);
    const paso = disponibles.shift()!;
    resultado.push(paso);
    for (const id of siguientes.get(paso.id) ?? []) {
      const cantidad = pendientes.get(id)! - 1;
      pendientes.set(id, cantidad);
      if (cantidad === 0) disponibles.push(porId.get(id)!);
    }
  }
  // Un grafo inválido no debe ocultar pasos. La validación y la ejecución
  // conservan sus controles; el orden visual no habilita ninguna acción.
  const vistos = new Set(resultado.map((p) => p.id));
  return [...resultado, ...porIndice.filter((p) => !vistos.has(p.id))];
}
