import type { MaterialesOrden } from '../ordenes-trabajo/materiales-orden.proyeccion';

/** Mantiene unidades y consumibles separados para aplicar la política del tenant. */
export function solicitudDesdeMateriales(
  proyeccion: Pick<MaterialesOrden, 'necesidades' | 'pendientes'>,
) {
  const materiales = proyeccion.necesidades.flatMap((n) =>
    [false, true].flatMap((consumible) => {
      const origenes = n.origenes.filter(
        (o) => (o.tipo === 'consumible') === consumible,
      );
      if (!origenes.length) return [];
      const unidad = origenes[0].unidadStock;
      const validos =
        unidad &&
        origenes.every(
          (o) =>
            !o.observacion &&
            o.cantidadStock !== null &&
            o.unidadStock === unidad,
        );
      return [
        {
          varianteId: n.varianteId,
          unidad: validos ? unidad : null,
          cantidad: validos
            ? Number(
                origenes
                  .reduce((sum, o) => sum + o.cantidadStock!, 0)
                  .toFixed(8),
              )
            : null,
          consumible,
        },
      ];
    }),
  );
  return { materiales, pendientes: proyeccion.pendientes.length };
}
