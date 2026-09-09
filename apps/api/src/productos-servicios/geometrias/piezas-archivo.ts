import type {
  EntidadInspeccion,
  FuenteGuardada,
  InspeccionVector,
  SeleccionVector,
} from './interpretar-vector';

type Punto = { x: number; y: number };
export type PiezaInspeccion = { exteriorId: string; interioresIds: string[] };

/** Guarda una sola copia de los recorridos de cada pieza. Los identificadores
 * excluidos permiten revisar la interpretación sin copiar todo el DXF N veces. */
export function compactarPiezaArchivo(fuente: FuenteGuardada): FuenteGuardada {
  if (!fuente.fabricacion) return fuente;
  return {
    ...fuente,
    procedencia: {
      ...fuente.procedencia,
      entidadesExcluidas: fuente.fabricacion.entidades
        .filter((e) => !e.conservar)
        .map((e) => e.entidadId),
    },
    fabricacion: {
      ...fuente.fabricacion,
      entidades: fuente.fabricacion.entidades.filter((e) => e.conservar),
    },
  };
}

function contienePunto(poligono: Punto[], p: Punto) {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[j],
      b = poligono[i];
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
    if (Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) < 1e-7) return true;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      dentro = !dentro;
  }
  return dentro;
}

function contiene(exterior: EntidadInspeccion, entidad: EntidadInspeccion) {
  const puntos = entidad.puntos.length
    ? entidad.puntos
    : entidad.texto
      ? [entidad.texto]
      : [];
  return (
    puntos.length > 0 &&
    puntos.every((p, i) => {
      if (!contienePunto(exterior.puntos, p)) return false;
      const q = puntos[(i + 1) % puntos.length];
      return (
        (!entidad.cerrada && i === puntos.length - 1) ||
        contienePunto(exterior.puntos, {
          x: (p.x + q.x) / 2,
          y: (p.y + q.y) / 2,
        })
      );
    })
  );
}

/** La jerarquía se calcula por capa. Un hendido de otra capa nunca se
 * convierte en hueco, y las islas dentro de un hueco son piezas independientes. */
export function detectarPiezasArchivo(
  inspeccion: InspeccionVector,
): PiezaInspeccion[] {
  const candidatas = inspeccion.entidades.filter(
    (e) => e.area > 1e-8 && e.exportable !== false,
  );
  const padres = new Map<string, EntidadInspeccion | undefined>();
  for (const e of candidatas)
    padres.set(
      e.id,
      candidatas
        .filter(
          (p) =>
            p.capa === e.capa &&
            p.cerrada &&
            p.area > e.area + 1e-8 &&
            contiene(p, e),
        )
        .sort((a, b) => a.area - b.area)[0],
    );
  const profundidad = (e: EntidadInspeccion): number => {
    const padre = padres.get(e.id);
    return padre ? 1 + profundidad(padre) : 0;
  };
  return candidatas
    .filter((e) => profundidad(e) % 2 === 0)
    .sort(
      (a, b) =>
        Math.min(...a.puntos.map((p) => p.y)) -
          Math.min(...b.puntos.map((p) => p.y)) ||
        Math.min(...a.puntos.map((p) => p.x)) -
          Math.min(...b.puntos.map((p) => p.x)),
    )
    .map((e) => ({
      exteriorId: e.id,
      interioresIds: candidatas
        .filter((p) => padres.get(p.id)?.id === e.id && p.cerrada)
        .map((p) => p.id),
    }));
}

/** Incluye piezas separadas de distintas capas; los contornos de otras capas
 * contenidos en una pieza se mantienen como recorridos de fabricación. */
export function sugerirPiezasArchivo(inspeccion: InspeccionVector): string[] {
  return detectarPiezasArchivo(inspeccion)
    .filter((p) => {
      const e = inspeccion.entidades.find((e) => e.id === p.exteriorId)!;
      return !inspeccion.entidades.some(
        (otra) =>
          otra.capa !== e.capa &&
          otra.cerrada &&
          otra.area > e.area + 1e-8 &&
          contiene(otra, e),
      );
    })
    .map((p) => p.exteriorId);
}

/** Cada copia exporta sólo las entidades de su propia pieza. El archivo
 * original sigue intacto y cada interpretación conserva sus handles nativos. */
export function separarPiezasArchivo(
  inspeccion: InspeccionVector,
  seleccion: SeleccionVector & { exteriorIds: string[] },
) {
  const ids = seleccion.exteriorIds;
  if (!ids.length || ids.length > 30 || new Set(ids).size !== ids.length)
    throw new Error('Seleccioná entre 1 y 30 piezas distintas para importar.');
  const detectadas = detectarPiezasArchivo(inspeccion);
  const elegidas = ids.map((id) => {
    const e = inspeccion.entidades.find((e) => e.id === id);
    if (!e || !detectadas.some((p) => p.exteriorId === id))
      throw new Error(
        'La selección contiene un contorno interior o una pieza inválida.',
      );
    return e;
  });
  const capas = new Set(elegidas.map((e) => e.capa));
  const separadas = new Set(sugerirPiezasArchivo(inspeccion));
  const exteriores = detectadas.flatMap((p) => {
    const e = inspeccion.entidades.find((e) => e.id === p.exteriorId)!;
    return capas.has(e.capa) || separadas.has(e.id) ? [e] : [];
  });
  const asignadas = new Map(
    exteriores.map((e) => [e.id, [] as EntidadInspeccion[]]),
  );
  const excluidas = new Set(seleccion.excluidas ?? []);
  if (
    excluidas.size !== (seleccion.excluidas ?? []).length ||
    [...excluidas].some((id) => !inspeccion.entidades.some((e) => e.id === id))
  )
    throw new Error('La exclusión contiene entidades inválidas.');
  if (
    new Set(seleccion.operaciones.map((o) => o.entidadId)).size !==
      seleccion.operaciones.length ||
    seleccion.operaciones.some(
      (o) =>
        !inspeccion.entidades.some((e) => e.id === o.entidadId) ||
        ids.includes(o.entidadId),
    )
  )
    throw new Error(
      'Las operaciones contienen entidades inválidas o repetidas.',
    );
  if (ids.some((id) => excluidas.has(id)))
    throw new Error('No se puede excluir una pieza seleccionada para nesting.');
  for (const e of inspeccion.entidades) {
    if (excluidas.has(e.id)) continue;
    const propietario =
      exteriores.find((p) => p.id === e.id) ??
      exteriores
        .filter((p) => contiene(p, e))
        .sort((a, b) => a.area - b.area)[0];
    if (!propietario)
      throw new Error(
        `El recorrido «${e.capa} · ${e.id}» queda fuera de las piezas. Revisá su capa o excluilo antes de separar el archivo.`,
      );
    asignadas.get(propietario.id)!.push(e);
  }
  return elegidas.map((e) => {
    const entidades = asignadas.get(e.id)!;
    const idsPropios = new Set(entidades.map((v) => v.id));
    const interiores = detectadas.find(
      (p) => p.exteriorId === e.id,
    )!.interioresIds;
    const operaciones = seleccion.operaciones.filter(
      (o) => idsPropios.has(o.entidadId) && o.entidadId !== e.id,
    );
    for (const id of interiores)
      if (idsPropios.has(id) && !operaciones.some((o) => o.entidadId === id))
        operaciones.push({ entidadId: id, tipo: 'CORTE_INTERIOR' });
    return {
      inspeccion,
      seleccion: {
        ...seleccion,
        exteriorId: e.id,
        exteriorIds: undefined,
        excluidas: inspeccion.entidades
          .filter((v) => !idsPropios.has(v.id))
          .map((v) => v.id),
        operaciones,
      },
    };
  });
}
