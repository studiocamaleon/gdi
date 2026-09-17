type PasoFronteraDAG = {
  id: string;
  indice: number;
  nodoClave?: string | null;
  estado: string;
  dependenciasEntrantes?: Array<{ predecesorPasoId: string }>;
  gatesOperativos?: Array<{ estado: string }>;
};

/**
 * Fronteras realmente disponibles de una OT. En un DAG puede devolver más de
 * un paso del mismo ítem; las dependencias pueden venir de un componente hijo.
 * Para órdenes históricas sin identidad de nodo conserva la secuencia lineal.
 */
export function fronterasEjecutablesDAG<T extends PasoFronteraDAG>(
  pasosOrden: T[],
  pasosItem: T[],
): T[] {
  const estadoPorId = new Map(
    pasosOrden.map((paso) => [paso.id, paso.estado] as const),
  );
  const usaGrafo =
    pasosItem.length > 0 && pasosItem.every((paso) => paso.nodoClave);
  if (!usaGrafo) {
    const primero = [...pasosItem]
      .sort((a, b) => a.indice - b.indice)
      .find((paso) => paso.estado !== 'hecho');
    return primero &&
      (primero.gatesOperativos ?? []).every((g) => g.estado === 'CUMPLIDO')
      ? [primero]
      : [];
  }
  return pasosItem.filter(
    (paso) =>
      paso.estado !== 'hecho' &&
      (paso.gatesOperativos ?? []).every((g) => g.estado === 'CUMPLIDO') &&
      (paso.dependenciasEntrantes ?? []).every(
        (dependencia) =>
          estadoPorId.get(dependencia.predecesorPasoId) === 'hecho',
      ),
  );
}
