import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/** Incluye componentes y lotes: cambiar el padre también reemplaza su trabajo. */
export async function bloqueosEdicionProductos(
  db: Prisma.TransactionClient,
  tenantId: string,
  ordenId: string,
) {
  const items = await db.ordenTrabajoItem.findMany({
    where: { tenantId, ordenId },
    select: {
      id: true,
      parentItemId: true,
      entregadoEl: true,
      listoEnMostradorEl: true,
      pasos: {
        select: {
          estado: true,
          iniciadoEl: true,
          completadoEl: true,
          estadoCompra: true,
          nestingLoteId: true,
          _count: { select: { tramos: true } },
        },
      },
    },
  });
  const padres = new Map(items.map((i) => [i.id, i.parentItemId]));
  const bloqueados = new Map<string, string>();
  for (const item of items) {
    const motivo =
      item.entregadoEl || item.listoEnMostradorEl
        ? 'Este producto ya fue terminado o entregado.'
        : item.pasos.some((p) => p.nestingLoteId)
          ? 'Este producto forma parte de una tanda compartida. Separá la tanda antes de editarlo.'
          : item.pasos.some(
                (p) =>
                  p.estado !== 'pendiente' ||
                  p.iniciadoEl ||
                  p.completadoEl ||
                  p._count.tramos > 0 ||
                  (p.estadoCompra && p.estadoCompra !== 'pendiente'),
              )
            ? 'Este producto ya tiene trabajo iniciado o una compra en curso.'
            : null;
    if (!motivo) continue;
    let id: string | null | undefined = item.id;
    const vistos = new Set<string>();
    while (id && !vistos.has(id)) {
      vistos.add(id);
      bloqueados.set(id, motivo);
      id = padres.get(id);
    }
  }
  return bloqueados;
}

/** Llamar después de bloquear la OT, igual que ejecución y facturación. */
export async function exigirProductosEditablesTx(
  db: Prisma.TransactionClient,
  tenantId: string,
  ordenId: string,
  ids: string[],
) {
  const orden = await db.ordenTrabajo.findFirstOrThrow({
    where: { id: ordenId, tenantId },
    select: { facturadoTotal: true },
  });
  const factura = await db.comprobante.findFirst({
    where: {
      tenantId,
      tipo: 'factura',
      estado: { notIn: ['rechazado', 'anulado'] },
      OR: [{ ordenId }, { ordenes: { some: { ordenId } } }],
    },
    select: { id: true },
  });
  if (Number(orden.facturadoTotal) > 0 || factura)
    throw new ConflictException(
      'La orden tiene facturación emitida, preparada o en proceso. No se pueden modificar sus productos.',
    );
  if (!ids.length) return;
  const bloqueos = await bloqueosEdicionProductos(db, tenantId, ordenId);
  for (const id of ids)
    if (bloqueos.has(id)) throw new ConflictException(bloqueos.get(id));
}

/** Reemplazar una receta retira sus componentes pendientes, conservando adjuntos. */
export async function retirarComponentesPendientesTx(
  db: Prisma.TransactionClient,
  tenantId: string,
  ordenId: string,
  padreId: string,
) {
  const items = await db.ordenTrabajoItem.findMany({
    where: { tenantId, ordenId },
    select: { id: true, parentItemId: true },
  });
  const descendientes = new Set<string>();
  const pendientes = [padreId];
  while (pendientes.length) {
    const padre = pendientes.pop()!;
    for (const item of items)
      if (item.parentItemId === padre && !descendientes.has(item.id)) {
        descendientes.add(item.id);
        pendientes.push(item.id);
      }
  }
  if (!descendientes.size) return;
  await db.archivo.updateMany({
    where: {
      tenantId,
      scope: 'ORDEN_ITEM',
      ordenItemId: { in: [...descendientes] },
    },
    data: { ordenItemId: padreId },
  });
  await db.ordenTrabajoItem.deleteMany({
    where: { tenantId, ordenId, parentItemId: padreId },
  });
}
