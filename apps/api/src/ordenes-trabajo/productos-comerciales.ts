/** Agrupa el trabajo interno bajo el producto vendido, a cualquier profundidad.
 * Las participaciones de un lote no representan trabajo adicional. Para validar
 * una entrega también se exige que hayan recibido el cierre de su operación. */
export function productosComercialesConTrabajo<
  T extends {
    id: string;
    parentItemId?: string | null;
    pasos: Array<{ nestingLoteRol?: string | null }>;
    archivos?: unknown[];
  },
>(items: T[], incluirParticipaciones = false): T[] {
  const porId = new Map(items.map((item) => [item.id, item]));
  const grupos = new Map<string, T[]>();
  for (const item of items) {
    let actual = item;
    const visitados = new Set<string>();
    while (actual.parentItemId && !visitados.has(actual.id)) {
      visitados.add(actual.id);
      const padre = porId.get(actual.parentItemId);
      if (!padre) break;
      actual = padre;
    }
    const grupo = grupos.get(actual.id) ?? [];
    grupo.push(item);
    grupos.set(actual.id, grupo);
  }
  return items
    .filter((item) => !item.parentItemId)
    .map((raiz) => {
      const grupo = grupos.get(raiz.id) ?? [raiz];
      return {
        ...raiz,
        pasos: grupo
          .flatMap((item) => item.pasos)
          .filter(
            (paso) =>
              incluirParticipaciones || paso.nestingLoteRol !== 'PARTICIPANTE',
          ),
        ...(raiz.archivos
          ? { archivos: grupo.flatMap((item) => item.archivos ?? []) }
          : {}),
      } as T;
    });
}
