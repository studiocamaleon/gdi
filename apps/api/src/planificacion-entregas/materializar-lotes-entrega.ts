import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { CotizacionResultado } from '../motor-universal/tipos';
import type { ResultadoPlanGuardado } from './planificacion-contrato';

export const nombreLoteProduccion = (secuencia: number) => {
  let n = secuencia + 1,
    letra = '';
  while (n > 0) {
    n--;
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26);
  }
  return `Lote ${letra}`;
};

/** Modifica sólo producción pendiente, bajo el mismo cerrojo de las acciones
 * del tablero. El producto comercial conserva cantidad, cotización y precio. */
export async function materializarLotesEntrega(
  tx: Prisma.TransactionClient,
  db: Pick<PrismaService, 'prepararSnapshot'>,
  tenantId: string,
  productoItemId: string,
  retirar = false,
) {
  const raiz = await tx.ordenTrabajoItem.findFirstOrThrow({
    where: { id: productoItemId, tenantId, parentItemId: null },
    include: {
      planEntrega: true,
      orden: { select: { estado: true } },
      lotesEntrega: { select: { revisionId: true } },
    },
  });
  if (retirar && !raiz.contieneLotesEntrega) return null;
  const plan = raiz.planEntrega;
  if (!retirar && !plan?.alternativaElegidaId) return null;
  const revision =
    !retirar && plan
      ? await tx.planEntregaRevision.findFirst({
          where: {
            tenantId,
            planId: plan.id,
            numero: plan.revisionActual,
            estado: 'LISTA',
          },
          include: {
            fuentesProduccion: true,
            entregas: { orderBy: { secuencia: 'asc' } },
          },
        })
      : null;
  if (!retirar && (!revision || !plan?.alternativaElegidaId))
    throw new ConflictException(
      'Recalculá y guardá la distribución antes de emitir sus lotes.',
    );
  // Reintentar o emitir un borrador reutiliza las mismas identidades y archivos.
  if (
    revision &&
    raiz.lotesEntrega.length &&
    raiz.lotesEntrega.every((l) => l.revisionId === revision.id)
  )
    return tx.ordenTrabajoItem.findMany({
      where: { tenantId, parentItemId: raiz.id },
      select: { id: true, ordenId: true, cotizacionItemId: true },
    });
  const tomada = await tx.ordenTrabajo.updateMany({
    where: {
      id: raiz.ordenId,
      tenantId,
      estado: { in: ['borrador', 'pendiente'] },
    },
    data: { updatedAt: new Date() },
  });
  if (tomada.count !== 1)
    throw new ConflictException(
      'La orden ya comenzó su producción. No se pueden reemplazar sus lotes.',
    );
  const arbol = await tx.ordenTrabajoItem.findMany({
    where: { tenantId, ordenId: raiz.ordenId },
    select: {
      id: true,
      parentItemId: true,
      _count: { select: { archivos: true } },
      pasos: {
        select: {
          estado: true,
          iniciadoEl: true,
          estadoCompra: true,
          mesaUsuarioId: true,
          gatesOperativos: { select: { estado: true } },
        },
      },
    },
  });
  const ids = new Set([raiz.id]);
  for (let cambio = true; cambio; ) {
    cambio = false;
    for (const i of arbol)
      if (i.parentItemId && ids.has(i.parentItemId) && !ids.has(i.id)) {
        ids.add(i.id);
        cambio = true;
      }
  }
  for (const i of arbol.filter((i) => ids.has(i.id))) {
    if (
      i.pasos.some(
        (p) =>
          p.estado !== 'pendiente' ||
          p.iniciadoEl ||
          p.mesaUsuarioId ||
          (p.estadoCompra && p.estadoCompra !== 'pendiente') ||
          p.gatesOperativos.some((g) => g.estado !== 'PENDIENTE'),
      )
    )
      throw new ConflictException(
        'Hay trabajo o condiciones de producción registrados. No se pueden reemplazar los lotes.',
      );
    if (i.id !== raiz.id && i._count.archivos)
      throw new ConflictException(
        'Hay archivos adjuntos en producción. Revisalos antes de reemplazar la distribución.',
      );
  }
  const gatesManuales = await tx.gateProduccionDocumento.count({
    where: {
      tenantId,
      ordenId: raiz.ordenId,
      activo: true,
      recetaDocumentoId: null,
      OR: [
        { paso: { itemId: { in: [...ids] } } },
        { ordenItemId: { in: [...ids].filter((id) => id !== raiz.id) } },
      ],
    },
  });
  if (gatesManuales)
    throw new ConflictException(
      'Hay aprobaciones documentales propias de estos trabajos. Revisalas antes de reemplazar sus lotes.',
    );
  const resultado =
    revision?.resultadoJson as unknown as ResultadoPlanGuardado | null;
  const alternativa = resultado?.resultado.alternativas.find(
    (a) => a.id === plan?.alternativaElegidaId,
  );
  if (
    revision &&
    (resultado?.politica !== 'POR_ENTREGA' ||
      !alternativa ||
      !['VIABLE', 'SIN_MARGEN', 'CONDICIONADA'].includes(alternativa.estado) ||
      (resultado.nesting?.estado === 'REQUIERE_AJUSTE' &&
        !plan?.ajusteNestingAceptado))
  )
    throw new ConflictException(
      'La distribución necesita revisión o aceptación de sus layouts.',
    );
  const fuentes = new Map(
    revision?.fuentesProduccion.map((f) => [f.cantidad, f]) ?? [],
  );
  if (
    revision &&
    (revision.entregas.reduce((s, e) => s + e.cantidad, 0) !==
      Number(raiz.cantidad) ||
      revision.entregas.some((e) => !fuentes.has(e.cantidad)))
  )
    throw new ConflictException(
      'Esta propuesta todavía no conserva los cálculos por lote. Recalculá la distribución.',
    );
  // Validar todo antes de sustituir; cualquier fallo posterior revierte la tx.
  for (const f of fuentes.values()) {
    const c = f.calculoJson as unknown as CotizacionResultado;
    if (
      c.cantidadPedida !== f.cantidad ||
      !c.receta ||
      c.receta.revisionId !== raiz.recetaRevisionId ||
      c.receta.huella !== raiz.recetaHuella
    )
      throw new ConflictException(
        'La receta del lote difiere de la cotizada. Actualizá la cotización antes de planificar.',
      );
  }
  await tx.ordenTrabajoItemPaso.deleteMany({
    where: { tenantId, itemId: { in: [...ids] } },
  });
  // El cascade elimina también componentes anidados y preparaciones obsoletas.
  await tx.ordenTrabajoItem.deleteMany({
    where: { tenantId, parentItemId: raiz.id },
  });
  await tx.loteProduccionEntrega.deleteMany({
    where: { tenantId, productoItemId: raiz.id },
  });
  await tx.ordenTrabajoItem.update({
    where: { id: raiz.id },
    data: {
      contieneLotesEntrega: !retirar,
      grafoProduccionSnapshotJson: Prisma.DbNull,
    },
    select: { id: true },
  });
  if (retirar || !revision || !alternativa) return [];
  const trabajos: {
    id: string;
    ordenId: string;
    cotizacionItemId: string | null;
  }[] = [];
  for (const e of revision.entregas) {
    const f = fuentes.get(e.cantidad)!;
    const c = f.calculoJson as unknown as CotizacionResultado;
    const fecha =
      e.fechaSolicitada?.toISOString().slice(0, 10) ??
      alternativa.entregas.find((a) => a.id === e.clave)?.fechaSugerida;
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha))
      throw new ConflictException(
        'Falta la fecha del lote. Recalculá su distribución.',
      );
    const lote = await tx.loteProduccionEntrega.create({
      data: {
        tenantId,
        revisionId: revision.id,
        fuenteId: f.id,
        productoItemId: raiz.id,
        clave: e.clave,
        secuencia: e.secuencia,
        cantidad: e.cantidad,
        fechaEntrega: new Date(`${fecha}T00:00:00.000Z`),
      },
    });
    const data = db.prepararSnapshot('OrdenTrabajoItem', {
      tenantId,
      ordenId: raiz.ordenId,
      parentItemId: raiz.id,
      loteEntregaId: lote.id,
      componenteCodigo: `entrega:${e.clave}`.slice(0, 100),
      recetaRevisionId: raiz.recetaRevisionId,
      recetaVersion: raiz.recetaVersion,
      recetaHuella: raiz.recetaHuella,
      recetaSnapshotJson: raiz.recetaSnapshotJson ?? Prisma.DbNull,
      jobContextSnapshotJson: f.contextoJson,
      trazabilidadSnapshotJson: {
        pasos: c.pasos,
        componentesFabricados: c.componentesFabricados ?? [],
        analisisNestingCompuesto: c.analisisNestingCompuesto ?? null,
        costos: c.costos,
      },
      fechaEntrega: lote.fechaEntrega,
      codigo: `${raiz.codigo}/${nombreLoteProduccion(e.secuencia)}`.slice(
        0,
        180,
      ),
      nombre: `${raiz.nombre} · ${nombreLoteProduccion(e.secuencia)}`,
      familia: 'Lote de producción',
      categoriaComercial: 'Producción interna',
      subcategoriaComercial: 'Lote de entrega',
      cantidad: e.cantidad,
      cantidadUnidad: raiz.cantidadUnidad,
      subtotal: 0,
      impuestos: 0,
      total: 0,
      ordenIndice: raiz.ordenIndice,
    });
    trabajos.push(
      await tx.ordenTrabajoItem.create({
        data: data as unknown as Prisma.OrdenTrabajoItemUncheckedCreateInput,
        select: { id: true, ordenId: true, cotizacionItemId: true },
      }),
    );
  }
  return trabajos;
}
