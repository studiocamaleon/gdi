/** Misma colección para piezas de receta, productos simples y diseños heredados. */
export function esColeccionVectorialValida(
  value: unknown,
  validarFuente: (fuente: unknown) => boolean,
): boolean {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30)
    return false;
  const ids = new Set<string>();
  return value.every((p: unknown) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
    const pieza = p as Record<string, unknown>;
    if (
      typeof pieza.id !== 'string' ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(pieza.id) ||
      ids.has(pieza.id) ||
      typeof pieza.nombre !== 'string' ||
      !pieza.nombre.trim() ||
      pieza.nombre.length > 120 ||
      !Number.isSafeInteger(pieza.cantidadPorUnidad) ||
      Number(pieza.cantidadPorUnidad) < 1 ||
      Number(pieza.cantidadPorUnidad) > 10000 ||
      !validarFuente(pieza.fuente)
    )
      return false;
    ids.add(pieza.id);
    return true;
  });
}
