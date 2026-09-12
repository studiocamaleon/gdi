import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { huellaOrigenCotizacion, huellaPlan } from './planificacion-contrato';
import type { VincularPlanEntregaDto } from './planificacion.dto';
import { actualizarFechaFinalOrden } from './resumen-entregas';
import type { ResultadoPlanGuardado } from './planificacion-contrato';
import { huellaFuenteProductiva } from './fuente-productiva-equivalente';

type ItemConPlan = {
  cotizacionItemId: string;
  cantidad: number;
  nombre: string;
  planEntrega?: VincularPlanEntregaDto;
};
/** Antes de insertar la OT. Mantiene los cerrojos hasta el mismo commit de alta. */
export async function prepararVinculosEntrega(
  tx: Prisma.TransactionClient,
  tenantId: string,
  clienteId: string | null,
  items: ItemConPlan[],
  contexto?: { huella: string; ahora: Date },
) {
  const conPlan = items
    .filter((i) => i.planEntrega)
    .sort((a, b) => a.planEntrega!.planId.localeCompare(b.planEntrega!.planId));
  if (!conPlan.length) return [];
  if (
    new Set(conPlan.map((i) => i.planEntrega!.planId)).size !== conPlan.length
  )
    throw new BadRequestException(
      'Una distribución no puede usarse en dos productos.',
    );
  // Mismo orden que solicitar(): empresa → plan → snapshot. Esto evita
  // insertar primero FKs que impidan escalar el cerrojo de la cotización.
  await tx.$queryRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId}::uuid FOR UPDATE`;
  const vinculos: {
    planId: string;
    revisionId: string;
    cotizacionItemId: string;
    cotizacionVersion: Date;
    recetaRevisionId: string | null;
    recetaHuella: string | null;
  }[] = [];
  for (const item of conPlan) {
    const dto = item.planEntrega!;
    await tx.$queryRaw`SELECT "id" FROM "PlanEntregaItem" WHERE "id" = ${dto.planId}::uuid AND "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    const p = await tx.planEntregaItem.findFirst({
      where: { id: dto.planId, tenantId },
      select: {
        id: true,
        ordenItemId: true,
        cotizacionItemId: true,
        version: true,
        revisionActual: true,
        alternativaElegidaId: true,
        ajusteNestingAceptado: true,
        cambioEntregasAceptado: true,
      },
    });
    if (
      !p ||
      p.ordenItemId ||
      !p.cotizacionItemId ||
      p.version !== dto.expectedVersion
    )
      throw new ConflictException(
        `La distribución de "${item.nombre}" cambió o ya pertenece a otra OT. Revisala antes de guardar.`,
      );
    await tx.$queryRaw`SELECT "id" FROM "CotizacionItem" WHERE "id" IN (${item.cotizacionItemId}::uuid, ${p.cotizacionItemId}::uuid) AND "tenantId" = ${tenantId}::uuid ORDER BY "id" FOR UPDATE`;
    const c = await tx.cotizacionItem.findFirstOrThrow({
      where: { id: item.cotizacionItemId, tenantId },
      select: {
        id: true,
        cantidad: true,
        updatedAt: true,
        recetaRevisionId: true,
        recetaHuella: true,
        cotizacion: { select: { clienteId: true } },
      },
    });
    const origen =
      p.cotizacionItemId === c.id
        ? c
        : await tx.cotizacionItem.findFirstOrThrow({
            where: { id: p.cotizacionItemId, tenantId },
            select: {
              id: true,
              cantidad: true,
              updatedAt: true,
              recetaRevisionId: true,
              recetaHuella: true,
              cotizacion: { select: { clienteId: true } },
            },
          });
    if (origen.id !== c.id) {
      const fuentes = await tx.cotizacionItem.findMany({
        where: { tenantId, id: { in: [origen.id, c.id] } },
        select: {
          id: true,
          productoId: true,
          rutaAlternativaId: true,
          cantidad: true,
          recetaRevisionId: true,
          recetaHuella: true,
          jobContextJson: true,
          snapshotJson: true,
          trazabilidadJson: true,
          ordenTrabajoItems: { select: { id: true }, take: 1 },
          planEntrega: { select: { id: true } },
        },
      });
      const destino = fuentes.find((f) => f.id === c.id);
      if (
        fuentes.length !== 2 ||
        !destino ||
        destino.ordenTrabajoItems.length ||
        destino.planEntrega ||
        huellaFuenteProductiva(fuentes[0]) !==
          huellaFuenteProductiva(fuentes[1])
      )
        throw new ConflictException(
          `Cambió la fabricación de "${item.nombre}". Revisá su distribución antes de guardar la OT.`,
        );
    }
    const r = await tx.planEntregaRevision.findFirst({
      where: {
        id: dto.revisionId,
        tenantId,
        planId: p.id,
        numero: p.revisionActual,
      },
      select: {
        id: true,
        estado: true,
        origenHuella: true,
        cantidad: true,
        resultadoJson: true,
        contextoHuella: true,
        calculadaEl: true,
        entregas: { select: { cantidad: true } },
      },
    });
    if (
      !r ||
      r.origenHuella !== huellaOrigenCotizacion(origen) ||
      c.cotizacion.clienteId !== clienteId ||
      Number(c.cantidad) !== item.cantidad ||
      r.cantidad !== item.cantidad ||
      r.entregas.reduce((s, e) => s + e.cantidad, 0) !== item.cantidad
    )
      throw new ConflictException(
        `Cambió la cotización de "${item.nombre}". Revisá su distribución antes de guardar la OT.`,
      );
    if (r.estado === 'SOLICITADA' || r.estado === 'CALCULANDO')
      throw new ConflictException(
        `La distribución de "${item.nombre}" todavía se está calculando. Esperá a que termine antes de guardar.`,
      );
    // Una propuesta fallida no se transforma silenciosamente en un compromiso.
    if (r.estado !== 'LISTA')
      throw new ConflictException(
        `Revisá la distribución de "${item.nombre}" antes de guardar la OT.`,
      );
    const resultado =
      r.resultadoJson as unknown as ResultadoPlanGuardado | null;
    const alternativa = resultado?.resultado.alternativas.find(
      (a) => a.id === p.alternativaElegidaId,
    );
    if (
      !p.alternativaElegidaId ||
      resultado?.politica !== 'POR_ENTREGA' ||
      !alternativa ||
      (alternativa.reprogramacion?.entregasAfectadas.some(
        (e) => e.cambiaEntrega,
      ) &&
        !p.cambioEntregasAceptado) ||
      !['VIABLE', 'SIN_MARGEN', 'CONDICIONADA'].includes(alternativa.estado) ||
      (resultado.nesting?.estado === 'REQUIERE_AJUSTE' &&
        !p.ajusteNestingAceptado)
    )
      throw new ConflictException(
        `Guardá la distribución de "${item.nombre}" antes de crear la OT.`,
      );
    if (
      contexto &&
      (r.contextoHuella !== contexto.huella ||
        !r.calculadaEl ||
        contexto.ahora.getTime() - r.calculadaEl.getTime() > 5 * 60_000)
    )
      throw new ConflictException(
        `Cambió la proyección de "${item.nombre}". Recalculá su distribución antes de guardar la OT.`,
      );
    vinculos.push({
      planId: p.id,
      revisionId: r.id,
      cotizacionItemId: c.id,
      cotizacionVersion: c.updatedAt,
      recetaRevisionId: c.recetaRevisionId,
      recetaHuella: c.recetaHuella,
    });
  }
  return vinculos;
}

/** El cambio de origen cotización → OT conserva la revisión y su elección. */
export async function vincularEntregasAlCrear(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ordenId: string,
  vinculos: Awaited<ReturnType<typeof prepararVinculosEntrega>>,
) {
  if (!vinculos.length) return;
  // Primero vincula todos los planes; la fecha final debe ver todos los ítems.
  for (const v of vinculos) {
    const item = await tx.ordenTrabajoItem.findFirstOrThrow({
      where: {
        tenantId,
        ordenId,
        parentItemId: null,
        cotizacionItemId: v.cotizacionItemId,
      },
      select: { id: true },
    });
    await tx.planEntregaItem.update({
      where: { id: v.planId, tenantId },
      data: {
        ordenItemId: item.id,
        cotizacionItemId: v.cotizacionItemId,
        version: { increment: 1 },
      },
    });
  }
  await actualizarFechaFinalOrden(tx, tenantId, ordenId);
  const orden = await tx.ordenTrabajo.findFirstOrThrow({
    where: { id: ordenId, tenantId },
    select: {
      updatedAt: true,
      estado: true,
      items: {
        where: { parentItemId: null },
        select: {
          id: true,
          cotizacionItemId: true,
          cantidad: true,
          recetaRevisionId: true,
          recetaHuella: true,
        },
      },
    },
  });
  for (const v of vinculos) {
    const item = orden.items.find(
      (i) => i.cotizacionItemId === v.cotizacionItemId,
    );
    if (!item)
      throw new ConflictException(
        'No se pudo vincular la distribución al producto de la OT.',
      );
    await tx.planEntregaRevision.update({
      where: { id: v.revisionId, tenantId },
      data: {
        origenHuella: huellaPlan({
          itemId: item.id,
          cantidad: Number(item.cantidad),
          cotizacionId: v.cotizacionItemId,
          cotizacionVersion: v.cotizacionVersion,
          recetaRevisionId: item.recetaRevisionId ?? v.recetaRevisionId,
          recetaHuella: item.recetaHuella ?? v.recetaHuella,
          ordenVersion: orden.updatedAt,
          estado: orden.estado,
        }),
      },
    });
  }
}
