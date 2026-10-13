import { DecimalComercial as D } from './validaciones';

type Componente = {
  pasos?: {
    activado?: boolean;
    tercerizado?: boolean;
    tiempo?: { costo?: number; tiemposExtra?: { costo: number }[] };
  }[];
  componentes?: Componente[];
};

/** Misma definición que Costos de la OT: el tiempo interno es estructura;
 * materiales, proveedores, cargos y costos sin detalle siguen siendo variables.
 * Sólo se excluyen importes identificados: un snapshot antiguo no se abarata.
 */
export function separarCostoContribucion(cotizacion: {
  costos: { total: number; tiempoTotal?: number; tiempoExtraTotal?: number };
  componentesFabricados?: Componente[];
}) {
  const importe = (n: number) => {
    if (!Number.isFinite(n) || n < 0)
      throw new Error('Costo productivo inválido.');
    return new D(n);
  };
  const tiemposComponentes = (
    componentes: Componente[],
  ): InstanceType<typeof D> =>
    componentes.reduce(
      (s, c) =>
        s
          .plus(
            (c.pasos ?? []).reduce((t, p) => {
              if (!p.activado || p.tercerizado) return t;
              return t
                .plus(importe(p.tiempo?.costo ?? 0))
                .plus(
                  (p.tiempo?.tiemposExtra ?? []).reduce(
                    (e, b) => e.plus(importe(b.costo)),
                    new D(0),
                  ),
                );
            }, new D(0)),
          )
          .plus(tiemposComponentes(c.componentes ?? [])),
      new D(0),
    );
  const total = importe(cotizacion.costos.total);
  const estructura = importe(cotizacion.costos.tiempoTotal ?? 0)
    .plus(importe(cotizacion.costos.tiempoExtraTotal ?? 0))
    .plus(tiemposComponentes(cotizacion.componentesFabricados ?? []));
  if (estructura.gt(total))
    throw new Error('El tiempo de estructura supera el costo productivo.');
  return { variable: total.minus(estructura), estructura };
}
