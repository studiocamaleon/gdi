/** Política comercial del producto. Ausente conserva el margen del taller. */
export function excluyeMargenEntrega(atributos: unknown): boolean {
  return (
    !!atributos &&
    typeof atributos === 'object' &&
    !Array.isArray(atributos) &&
    (atributos as Record<string, unknown>).excluirMargenEntrega === true
  );
}

export function margenEntregaProducto(
  margenGeneral: number,
  productoId: string | null | undefined,
  productosSinMargen: readonly string[] = [],
): number {
  return productoId && productosSinMargen.includes(productoId)
    ? 0
    : margenGeneral;
}
