/** Escenario de archivos consecutivos. No cambia el DAG guardado de la OT.
 * Espejo de apps/api/src/eta/motor/precedencias-tanda.ts. */
type Paso = { id: string; maquinaId?: string | null; estado: string };
export type TandaSimulada = { pasoIds: string[]; pasosPrevios?: string[] };

export function precedenciasTanda(
  pasos: Paso[],
  predecesores: Map<string, string[]>,
  grupos: TandaSimulada[],
): Map<string, string> {
  const porId = new Map(pasos.map((p) => [p.id, p]));
  const liberacion = new Map<string, string>();
  const maquinas = new Set<string>();
  const agregar = (id: string, previos: string[]) =>
    predecesores.set(id, [
      ...new Set([...(predecesores.get(id) ?? []), ...previos]),
    ]);
  // Validar todas las agrupaciones antes de alterar el escenario.
  for (const { pasoIds: ids, pasosPrevios = [] } of grupos) {
    const maquina = porId.get(ids[0])?.maquinaId;
    if (
      !ids.length ||
      ids.length > 50 ||
      new Set(ids).size !== ids.length ||
      !maquina ||
      maquinas.has(maquina)
    )
      throw new Error(
        'La tanda necesita entre 1 y 50 operaciones únicas de una misma máquina.',
      );
    maquinas.add(maquina);
    if (
      pasosPrevios.some(
        (id) =>
          !porId.has(id) ||
          porId.get(id)?.maquinaId !== maquina ||
          ids.includes(id),
      )
    )
      throw new Error(
        'La posición de la tanda en la máquina necesita revisión.',
      );
    for (const id of ids) {
      const paso = porId.get(id);
      if (
        !paso ||
        paso.maquinaId !== maquina ||
        paso.estado !== 'pendiente' ||
        (predecesores.get(id) ?? []).some(
          (p) => porId.get(p)?.estado !== 'hecho',
        )
      )
        throw new Error(
          'La tanda sólo puede incluir operaciones listas de una misma máquina.',
        );
    }
  }
  for (const { pasoIds: ids, pasosPrevios = [] } of grupos) {
    const miembros = new Set(ids),
      ultimo = ids[ids.length - 1];
    const maquina = porId.get(ids[0])!.maquinaId;
    const enCurso = pasos
      .filter((p) => p.maquinaId === maquina && p.estado === 'en_curso')
      .map((p) => p.id);
    agregar(ids[0], [...enCurso, ...pasosPrevios]);
    const anteriores = new Set(pasosPrevios);
    ids.forEach((id, i) => {
      if (i) agregar(id, [ids[i - 1]]);
      liberacion.set(id, ultimo);
    });
    for (const paso of pasos) {
      if (
        miembros.has(paso.id) ||
        paso.estado === 'hecho' ||
        paso.estado === 'en_curso'
      )
        continue;
      // Reservar la secuencia completa de archivos; no intercalar otros trabajos.
      // Los sucesores de cualquier integrante esperan el cierre del conjunto.
      if (
        (paso.maquinaId === maquina && !anteriores.has(paso.id)) ||
        (predecesores.get(paso.id) ?? []).some((p) => miembros.has(p))
      )
        agregar(paso.id, [ultimo]);
    }
  }
  return liberacion;
}
