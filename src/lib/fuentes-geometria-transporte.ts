/** El editor conserva la geometría completa. Al cotizar sólo viaja la identidad
 * de las interpretaciones guardadas; el servidor recupera sus capas y medidas. */
export function serializarCotizacion(request: unknown): string {
  return JSON.stringify(request, (_key, value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    const fuente = value as Record<string, unknown>;
    const p = fuente.procedencia as Record<string, unknown> | undefined;
    if (
      fuente.schemaVersion !== 2 ||
      typeof fuente.svg !== "string" ||
      !p ||
      p.version !== 1 ||
      typeof p.geometriaId !== "string" ||
      typeof p.archivoId !== "string" ||
      typeof p.hash !== "string"
    )
      return value;
    return {
      tipo: "REFERENCIA_GEOMETRIA",
      schemaVersion: 1,
      procedencia: {
        version: 1,
        geometriaId: p.geometriaId,
        archivoId: p.archivoId,
        hash: p.hash,
      },
    };
  });
}
