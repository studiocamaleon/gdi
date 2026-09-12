import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EtaService } from '../eta/eta.service';
import { bloquearColaEntrega } from './reprogramacion-bloqueo';
import {
  huellaContextoPlan,
  type ResultadoPlanGuardado,
} from './planificacion-contrato';
import { actualizarFechaFinalOrden } from './resumen-entregas';

/** Se revalida al emitir un borrador: la selección anterior no reserva capacidad. */
export async function validarReprogramacionAlEmitir(
  tx: Prisma.TransactionClient,
  eta: EtaService,
  tenantId: string,
  itemId: string,
) {
  const plan = await tx.planEntregaItem.findFirst({
    where: { tenantId, ordenItemId: itemId },
    include: { revisiones: { orderBy: { numero: 'desc' }, take: 1 } },
  });
  const lote = await tx.loteProduccionEntrega.findFirst({
    where: { tenantId, productoItemId: itemId },
    include: { revision: true },
  });
  const r = plan?.alternativaElegidaId ? plan.revisiones[0] : lote?.revision;
  if (!r || r.aplicadaEl || plan?.reprogramacionAplicadaRevisionId === r.id)
    return;
  const resultado = r.resultadoJson as unknown as ResultadoPlanGuardado;
  const eleccion = r.eleccionJson as { alternativaId?: string } | null;
  const a = resultado?.resultado.alternativas.find(
    (a) => a.id === (eleccion?.alternativaId ?? plan?.alternativaElegidaId),
  );
  if (!a?.reprogramacion) return;
  await bloquearColaEntrega(tx, tenantId);
  const raiz = await tx.ordenTrabajoItem.findFirstOrThrow({
    where: { tenantId, id: itemId },
    select: { ordenId: true },
  });
  const arbol = await tx.ordenTrabajoItem.findMany({
    where: { tenantId, ordenId: raiz.ordenId },
    select: { id: true, parentItemId: true },
  });
  const ids = new Set([itemId]);
  for (let cambio = true; cambio; ) {
    cambio = false;
    for (const i of arbol)
      if (i.parentItemId && ids.has(i.parentItemId) && !ids.has(i.id)) {
        ids.add(i.id);
        cambio = true;
      }
  }
  const c = await eta.contextoSimulacion(tenantId, tx);
  if (
    r.contextoHuella !==
      huellaContextoPlan(
        { ...c, items: c.items.filter((i) => !ids.has(i.id)) },
        c.margenEtaDias,
      ) ||
    !r.calculadaEl ||
    c.ahora.getTime() - r.calculadaEl.getTime() > 5 * 60_000
  )
    throw new ConflictException(
      'La reprogramación preparada cambió o venció. Volvé a Distribuir entregas y revisá las opciones antes de emitir.',
    );
}

/** Agenda, promesas explícitas e historial se publican en la misma tx de la OT. */
export async function aplicarReprogramacion(
  tx: Prisma.TransactionClient,
  tenantId: string,
  itemId: string,
  mapa: Map<string, string>,
) {
  const plan = await tx.planEntregaItem.findFirstOrThrow({
    where: { tenantId, ordenItemId: itemId },
    include: { revisiones: { orderBy: { numero: 'desc' }, take: 1 } },
  });
  const lote = await tx.loteProduccionEntrega.findFirst({
    where: { tenantId, productoItemId: itemId },
    include: { revision: true },
  });
  const r = lote?.revision ?? plan.revisiones[0];
  if (!r || r.aplicadaEl || plan.reprogramacionAplicadaRevisionId === r.id)
    return;
  const resultado = r.resultadoJson as unknown as ResultadoPlanGuardado;
  const eleccion = r.eleccionJson as {
    alternativaId?: string;
    cambioEntregasAceptado?: boolean;
    usuarioId?: string;
  } | null;
  const a = resultado.resultado.alternativas.find(
    (a) => a.id === (eleccion?.alternativaId ?? plan.alternativaElegidaId),
  );
  const propuesta = a?.reprogramacion;
  if (!propuesta) return;
  if (
    propuesta.entregasAfectadas.some((e) => e.cambiaEntrega) &&
    !(eleccion?.cambioEntregasAceptado ?? plan.cambioEntregasAceptado)
  )
    throw new ConflictException(
      'Las nuevas fechas de entrega requieren aceptación explícita.',
    );
  const agenda = propuesta.agenda.map((t) => ({
    ...t,
    pasoId: mapa.get(t.pasoId) ?? t.pasoId,
  }));
  if (
    agenda.some((t) => t.pasoId.startsWith('f6-')) ||
    new Set(agenda.map((t) => t.pasoId)).size !== agenda.length
  )
    throw new ConflictException(
      'No se pudieron vincular todas las operaciones de la agenda.',
    );
  // Actualización condicional: no reprograma pasos ejecutados ni de otra empresa.
  for (const t of agenda) {
    const c = await tx.ordenTrabajoItemPaso.updateMany({
      where: { tenantId, id: t.pasoId, estado: 'pendiente' },
      data: {
        planificadoDesde: new Date(t.inicio),
        planificadoHasta: new Date(t.fin),
        atencionPlanificadaJson: t.atencionPlanificada
          ? (JSON.parse(
              JSON.stringify(t.atencionPlanificada),
            ) as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
    });
    if (c.count !== 1)
      throw new ConflictException(
        'Un trabajo de la agenda cambió. Revisá la reprogramación.',
      );
  }
  const ordenes = new Set(propuesta.ordenesMovidas);
  const raiz = await tx.ordenTrabajoItem.findFirstOrThrow({
    where: { tenantId, id: itemId },
    select: { ordenId: true },
  });
  ordenes.add(raiz.ordenId);
  for (const e of propuesta.entregasAfectadas.filter((e) => e.cambiaEntrega)) {
    if (!e.fechaPropuesta)
      throw new ConflictException('Falta la nueva fecha comprometida.');
    const nueva = new Date(`${e.fechaPropuesta}T00:00:00Z`);
    if (e.loteId) {
      const c = await tx.loteProduccionEntrega.updateMany({
        where: {
          id: e.loteId,
          tenantId,
          fechaEntrega: new Date(`${e.fechaActual}T00:00:00Z`),
        },
        data: { fechaEntrega: nueva },
      });
      if (c.count !== 1)
        throw new ConflictException(
          'La fecha de un lote cambió. Revisá la propuesta.',
        );
    }
    await tx.ordenTrabajoItem.updateMany({
      where: { tenantId, id: { in: e.itemIds }, ordenId: e.ordenId },
      data: { fechaEntrega: nueva },
    });
    const orden = await tx.ordenTrabajo.findFirstOrThrow({
      where: { tenantId, id: e.ordenId },
      select: { fechaEntrega: true },
    });
    // Al cambiar el cierre global, los otros ítems conservan su promesa heredada.
    if (orden.fechaEntrega)
      await tx.ordenTrabajoItem.updateMany({
        where: { tenantId, ordenId: e.ordenId, fechaEntrega: null },
        data: { fechaEntrega: orden.fechaEntrega },
      });
    await actualizarFechaFinalOrden(tx, tenantId, e.ordenId);
  }
  for (const ordenId of ordenes) {
    await tx.ordenTrabajoEvento.create({
      data: {
        tenantId,
        ordenId,
        tipo: 'reprogramacion_entregas',
        origen: 'usuario',
        usuarioId: eleccion?.usuarioId ?? plan.elegidaPorId,
        usuarioNombre: 'Planificación de entregas',
        descripcion:
          'Se aplicó una reprogramación de producción con sus cambios de entrega aceptados.',
        datosJson: JSON.parse(
          JSON.stringify({
            planId: plan.id,
            revisionId: r.id,
            alternativaId: a.id,
            cambios: propuesta.cambios.filter((c) => c.ordenId === ordenId),
            entregas: propuesta.entregasAfectadas.filter(
              (e) => e.ordenId === ordenId,
            ),
          }),
        ) as Prisma.InputJsonValue,
      },
    });
  }
  await tx.planEntregaRevision.update({
    where: { tenantId, id: r.id },
    data: { aplicadaEl: new Date() },
  });
  await tx.planEntregaItem.update({
    where: { tenantId, id: plan.id },
    data: { reprogramacionAplicadaRevisionId: r.id },
  });
}
