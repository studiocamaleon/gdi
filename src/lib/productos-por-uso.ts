/** Orden estable y propio de cada empresa; sin uso previo, orden alfabético. */
export function compararProductosPorUso(
  a: { usosEnOrdenes?: number; nombre: string; id: string },
  b: { usosEnOrdenes?: number; nombre: string; id: string },
): number {
  return (
    (b.usosEnOrdenes ?? 0) - (a.usosEnOrdenes ?? 0) ||
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }) ||
    a.id.localeCompare(b.id)
  );
}
