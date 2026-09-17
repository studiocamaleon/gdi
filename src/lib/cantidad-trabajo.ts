export type PiezaConCantidad = {
  cantidad: number;
};

type ResolverCantidadTrabajoInput = {
  cantidadItem: number;
  cotizaLinealDirecto: boolean;
  usaMedidaPersonalizada: boolean;
  piezas: PiezaConCantidad[];
};

/**
 * Resuelve la cantidad que recibe el motor de cotización.
 *
 * Las cantidades por pieza sólo reemplazan a la cantidad general cuando el
 * usuario eligió efectivamente una medida personalizada. Que el producto
 * admita esa modalidad no alcanza: con una medida predefinida, la fuente sigue
 * siendo el control «Cantidad» del ítem.
 */
export function resolverCantidadTrabajo({
  cantidadItem,
  cotizaLinealDirecto,
  usaMedidaPersonalizada,
  piezas,
}: ResolverCantidadTrabajoInput): number {
  if (cotizaLinealDirecto) return 1;
  if (!usaMedidaPersonalizada) return cantidadItem;

  return (
    piezas.reduce(
      (total, pieza) =>
        total + (Number.isFinite(pieza.cantidad) ? pieza.cantidad : 0),
      0,
    ) || 1
  );
}
