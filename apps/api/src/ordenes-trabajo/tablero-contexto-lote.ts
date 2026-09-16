import type { Prisma } from '@prisma/client';
import { nombreLoteProduccion } from '../planificacion-entregas/materializar-lotes-entrega';

// Sólo identidad y cantidades: el tablero no necesita cargar snapshots de CAD.
export const loteTableroSelect = {
  id: true,
  secuencia: true,
  cantidad: true,
  productoItemId: true,
  producto: { select: { nombre: true, cantidadUnidad: true } },
} as const satisfies Prisma.LoteProduccionEntregaSelect;

type Lote = Prisma.LoteProduccionEntregaGetPayload<{
  select: typeof loteTableroSelect;
}>;

export function contextoLoteTablero(item: {
  parentItemId: string | null;
  loteEntrega?: Lote | null;
}) {
  const lote = item.loteEntrega;
  if (!lote) return null;
  return {
    id: lote.id,
    nombre: nombreLoteProduccion(lote.secuencia),
    cantidad: lote.cantidad,
    unidad: lote.producto.cantidadUnidad,
    productoNombre: lote.producto.nombre,
    esProductoDelLote: item.parentItemId === lote.productoItemId,
  };
}

export const dependenciaTableroSelect = {
  predecesorPasoId: true,
  predecesor: {
    select: {
      nombre: true,
      estado: true,
      item: {
        select: {
          id: true,
          nombre: true,
          parentItemId: true,
          loteEntrega: { select: loteTableroSelect },
        },
      },
    },
  },
} as const satisfies Prisma.OrdenTrabajoPasoDependenciaSelect;

type Dependencia = Prisma.OrdenTrabajoPasoDependenciaGetPayload<{
  select: typeof dependenciaTableroSelect;
}>;

export function esperasTablero(
  dependencias: {
    predecesorPasoId: string;
    predecesor?: Dependencia['predecesor'];
  }[],
) {
  return dependencias.flatMap(({ predecesorPasoId, predecesor: p }) => {
    if (!p || p.estado === 'hecho') return [];
    const lote = contextoLoteTablero(p.item);
    return [
      {
        pasoId: predecesorPasoId,
        pasoNombre: p.nombre,
        itemId: p.item.id,
        itemNombre: lote?.esProductoDelLote
          ? lote.productoNombre
          : p.item.nombre,
        loteNombre: lote?.nombre ?? null,
      },
    ];
  });
}

export type DependenciaTablero = {
  predecesorPasoId: string;
  predecesor?: Dependencia['predecesor'];
};
