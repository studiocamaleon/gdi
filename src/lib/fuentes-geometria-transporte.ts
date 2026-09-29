/** Adapta el estado del editor al contrato de cotización sin modificarlo.
 * Las fuentes guardadas viajan por identidad y la demanda de otros ítems sólo
 * incluye variante, cantidad y unidad; `consumible` pertenece a inventario. */
export function serializarCotizacion(request: unknown): string {
  const solicitud = prepararContextoMateriales(request);
  return JSON.stringify(solicitud, (_key, value: unknown) => {
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

function prepararContextoMateriales(request: unknown): unknown {
  if (!request || typeof request !== "object" || Array.isArray(request))
    return request;
  const solicitud = request as Record<string, unknown>;
  if (!Array.isArray(solicitud.contextoMateriales)) return request;
  return {
    ...solicitud,
    contextoMateriales: solicitud.contextoMateriales.map(
      (material: unknown) => {
        // Los datos malformados deben seguir siendo rechazados por la API.
        if (
          !material ||
          typeof material !== "object" ||
          Array.isArray(material)
        )
          return material;
        const { varianteId, cantidad, unidad } = material as Record<
          string,
          unknown
        >;
        return { varianteId, cantidad, unidad };
      },
    ),
  };
}
