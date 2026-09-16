import { Prisma } from '@prisma/client';
import type { ResultadoPlanGuardado } from './planificacion-contrato';

const selectPlan = Prisma.validator<Prisma.PlanEntregaItemSelect>()({
  ordenItemId: true,
  alternativaElegidaId: true,
  ordenItem: {
    select: {
      lotesEntrega: {
        orderBy: { secuencia: 'asc' },
        select: {
          id: true,
          clave: true,
          secuencia: true,
          cantidad: true,
          fechaEntrega: true,
          revisionId: true,
        },
      },
    },
  },
  revisiones: {
    orderBy: { numero: 'desc' },
    take: 1,
    select: {
      estado: true,
      resultadoJson: true,
      entregas: {
        orderBy: { secuencia: 'asc' },
        select: { clave: true, cantidad: true, fechaSolicitada: true },
      },
    },
  },
});
type PlanCompleto = Prisma.PlanEntregaItemGetPayload<{
  select: typeof selectPlan;
}>;
type Plan = Omit<PlanCompleto, 'ordenItem'> &
  Partial<Pick<PlanCompleto, 'ordenItem'>>;

/** Proyección compacta: sólo cantidades y fechas, sin costos ni geometrías. */
export function resumenEntregas(plan: Plan) {
  const revision = plan.revisiones[0];
  if (!revision) return null;
  const resultado =
    revision.resultadoJson as unknown as ResultadoPlanGuardado | null;
  const alternativa =
    revision.estado === 'LISTA'
      ? resultado?.resultado.alternativas.find(
          (a) => a.id === plan.alternativaElegidaId,
        )
      : undefined;
  return {
    lotes:
      plan.ordenItem?.lotesEntrega.map((l) => ({
        ...l,
        fechaEntrega: l.fechaEntrega.toISOString().slice(0, 10),
      })) ?? [],
    elegida: !!alternativa || !!plan.ordenItem?.lotesEntrega.length,
    estado: revision.estado,
    entregas: plan.ordenItem?.lotesEntrega.length
      ? plan.ordenItem.lotesEntrega.map((l) => ({
          clave: l.clave,
          cantidad: l.cantidad,
          fechaSolicitada: l.fechaEntrega.toISOString().slice(0, 10),
          fechaSugerida: null,
        }))
      : revision.entregas.map((e) => ({
          clave: e.clave,
          cantidad: e.cantidad,
          fechaSolicitada:
            e.fechaSolicitada?.toISOString().slice(0, 10) ?? null,
          fechaSugerida:
            alternativa?.entregas.find((a) => a.id === e.clave)
              ?.fechaSugerida ?? null,
        })),
  };
}
export type ResumenEntregas = NonNullable<ReturnType<typeof resumenEntregas>>;

export function fechaDistribucion(resumen: ResumenEntregas | null | undefined) {
  if (!resumen?.elegida || !resumen.entregas.length) return null;
  const fechas = resumen.entregas.map(
    (e) => e.fechaSolicitada || e.fechaSugerida,
  );
  if (fechas.some((f) => !f)) return null;
  return (
    fechas.reduce<string>((max, f) => (f && f > max ? f : max), '') || null
  );
}

export async function distribucionesDeItems(
  db: Pick<Prisma.TransactionClient, 'planEntregaItem'>,
  tenantId: string,
  itemIds: string[],
) {
  if (!itemIds.length) return new Map<string, ResumenEntregas | null>();
  const planes = await db.planEntregaItem.findMany({
    where: { tenantId, ordenItemId: { in: itemIds } },
    select: selectPlan,
  });
  return new Map(planes.map((p) => [p.ordenItemId!, resumenEntregas(p)]));
}

/** El cierre previsto es el último ítem comercial, sin contar sus subcomponentes. */
export async function actualizarFechaFinalOrden(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ordenId: string,
) {
  const orden = await tx.ordenTrabajo.findFirstOrThrow({
    where: { id: ordenId, tenantId },
    select: {
      fechaEntrega: true,
      items: {
        where: { parentItemId: null },
        select: { id: true, fechaEntrega: true },
      },
    },
  });
  const distribuciones = await distribucionesDeItems(
    tx,
    tenantId,
    orden.items.map((i) => i.id),
  );
  const anterior = orden.fechaEntrega?.toISOString().slice(0, 10) ?? null;
  const fechas = orden.items.map(
    (i) =>
      fechaDistribucion(distribuciones.get(i.id)) ??
      i.fechaEntrega?.toISOString().slice(0, 10) ??
      anterior,
  );
  const ultima =
    fechas.reduce<string>((max, f) => (f && f > max ? f : max), '') || anterior;
  if (ultima !== anterior)
    await tx.ordenTrabajo.update({
      where: { id: ordenId, tenantId },
      data: { fechaEntrega: ultima ? new Date(`${ultima}T00:00:00Z`) : null },
    });
  return ultima;
}
