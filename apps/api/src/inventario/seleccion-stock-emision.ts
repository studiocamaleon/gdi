import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { leerMaterialesOrden } from '../ordenes-trabajo/materiales-orden.consulta';
import { normalizeMaterialUnit } from './material-units';
import { bloquearVariantesStock, reservasPorSaldo } from './stock-reservas';

/** Conserva el material y el precio aceptados: si el stock cambió, pide revisar. */
export async function validarSeleccionStockAlEmitir(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ordenId: string,
) {
  const { orden, materiales } = await leerMaterialesOrden(
    tx,
    tenantId,
    ordenId,
  );
  const estrictos = new Set<string>();
  const visitar = (valor: unknown) => {
    if (!valor || typeof valor !== 'object') return;
    const nodo = valor as Record<string, unknown>;
    if (nodo.activado === false || nodo.activada === false) return;
    const seleccion = nodo.seleccionStock as
      | Record<string, unknown>
      | undefined;
    if (
      seleccion?.politica === 'SOLO_DISPONIBLES' &&
      typeof nodo.materialVarianteId === 'string'
    )
      estrictos.add(nodo.materialVarianteId);
    for (const clave of [
      'pasos',
      'materiales',
      'componentesFabricados',
      'componentes',
      'operacionesInternas',
    ])
      if (Array.isArray(nodo[clave]))
        for (const hijo of nodo[clave]) visitar(hijo);
  };
  for (const item of orden.items)
    visitar(
      item.trazabilidadSnapshotJson ?? item.cotizacionItem?.trazabilidadJson,
    );
  if (!estrictos.size) return;
  const ids = [...estrictos];
  await bloquearVariantesStock(tx, tenantId, ids);
  const [variantes, stocks, reservas, propias] = await Promise.all([
    tx.materiaPrimaVariante.findMany({
      where: { tenantId, id: { in: ids } },
      include: { materiaPrima: true },
    }),
    tx.stockMateriaPrimaVariante.findMany({
      where: {
        tenantId,
        varianteId: { in: ids },
        ubicacion: { activo: true, almacen: { activo: true } },
      },
    }),
    reservasPorSaldo(tx, tenantId, ids),
    tx.reservaMaterialOt.findMany({
      where: {
        tenantId,
        necesidad: { tenantId, ordenId, varianteId: { in: ids } },
      },
      include: { necesidad: true },
    }),
  ]);
  for (const id of ids) {
    const demanda = materiales.necesidades.find((m) => m.varianteId === id);
    const variante = variantes.find((v) => v.id === id);
    const unidad = variante
      ? normalizeMaterialUnit(
          variante.unidadStock ?? variante.materiaPrima.unidadStock,
        )
      : null;
    const libre = stocks
      .filter((s) => s.varianteId === id)
      .reduce((total, s) => {
        const propia = propias
          .filter(
            (r) =>
              r.necesidad.varianteId === id && r.ubicacionId === s.ubicacionId,
          )
          .reduce((n, r) => n.plus(r.cantidad), new Prisma.Decimal(0));
        return (
          total +
          Math.max(
            0,
            s.cantidadDisponible
              .minus(reservas.get(`${id}:${s.ubicacionId}`) ?? 0)
              .plus(propia)
              .toNumber(),
          )
        );
      }, 0);
    if (
      !demanda ||
      demanda.cantidad === null ||
      !unidad ||
      normalizeMaterialUnit(demanda.unidad ?? '') !== unidad ||
      demanda.cantidad > libre + 1e-8
    )
      throw new ConflictException(
        `El stock libre de ${demanda?.nombre ?? variante?.sku ?? 'un material'} ya no alcanza para esta OT. Se cotizó con «Sólo stock disponible». Revisá la selección antes de emitir; el material y el precio se conservaron.`,
      );
  }
}
