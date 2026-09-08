type Paso = { clave: string; configuracion: Record<string, unknown> };

/** El snapshot histórico conserva los pasos omitidos, pero no son demanda
 * de materiales, recursos ni documentos de la receta efectiva. */
export function clavesPasosOmitidos(snapshot: unknown): Set<string> {
  const pasos = (snapshot as { pasos?: Paso[] } | null)?.pasos;
  const omitidos = new Set<string>();
  if (!Array.isArray(pasos)) return omitidos;
  for (const paso of pasos) {
    if (
      paso.configuracion?.modoActivacion === 'NO_EJECUTAR' ||
      paso.configuracion?.rutaPasoActivo === false
    )
      omitidos.add(paso.clave);
  }
  let cantidad: number;
  do {
    cantidad = omitidos.size;
    for (const paso of pasos) {
      const contenedor = paso.configuracion?.contenedorClave;
      if (typeof contenedor === 'string' && omitidos.has(contenedor))
        omitidos.add(paso.clave);
    }
  } while (cantidad !== omitidos.size);
  return omitidos;
}

export function pasosEfectivos<T extends Paso>(snapshot: { pasos: T[] }): T[] {
  const omitidos = clavesPasosOmitidos(snapshot);
  return snapshot.pasos.filter((p) => !omitidos.has(p.clave));
}

export function proyectarBomEfectivo<
  T extends {
    snapshotJson?: unknown;
    materiales: Array<{ pasoClave: string }>;
    recursos: Array<{ pasoClave: string }>;
    documentos: Array<{ pasoClave: string | null }>;
  },
>(revision: T): T {
  const omitidos = clavesPasosOmitidos(revision.snapshotJson);
  if (!omitidos.size) return revision;
  return {
    ...revision,
    materiales: revision.materiales.filter((p) => !omitidos.has(p.pasoClave)),
    recursos: revision.recursos.filter((p) => !omitidos.has(p.pasoClave)),
    documentos: revision.documentos.filter(
      (p) => !p.pasoClave || !omitidos.has(p.pasoClave),
    ),
  };
}
