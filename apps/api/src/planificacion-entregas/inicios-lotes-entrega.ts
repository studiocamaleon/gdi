import { aplicarReprogramacion } from './reprogramacion-aplicar';
import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { ResultadoPlanGuardado } from './planificacion-contrato';

/** Empareja el DAG simulado con sus pasos reales, por ámbito y clave, nunca
 * por el nombre visible ni por el índice global de las operaciones. */
export async function fijarIniciosLotes(
  tx: Prisma.TransactionClient,
  tenantId: string,
  productoItemId: string,
) {
  const plan = await tx.planEntregaItem.findFirst({
    where: { tenantId, ordenItemId: productoItemId },
  });
  const mapa = new Map<string, string>();
  const lotes = await tx.loteProduccionEntrega.findMany({
    where: { tenantId, productoItemId },
    orderBy: { secuencia: 'asc' },
    include: {
      revision: {
        select: { resultadoJson: true, eleccionJson: true, aplicadaEl: true },
      },
      trabajos: {
        select: {
          id: true,
          parentItemId: true,
          componenteCodigo: true,
          pasos: {
            select: { id: true, nodoClave: true, duracionEstimadaMin: true },
          },
        },
      },
    },
  });
  let desde = 0;
  for (const lote of lotes) {
    const resultado = lote.revision
      .resultadoJson as unknown as ResultadoPlanGuardado;
    const eleccion = lote.revision.eleccionJson as {
      alternativaId?: string;
    } | null;
    const a = resultado.resultado.alternativas.find(
      (a) =>
        a.id ===
        (eleccion?.alternativaId ??
          (resultado.resultado.alternativas.some(
            (a) => a.id === plan?.alternativaElegidaId,
          )
            ? plan?.alternativaElegidaId
            : 'por-entrega')),
    )!;
    const ambitos = new Map<string, string>();
    for (let pendientes = lote.trabajos.length; pendientes > 0; ) {
      let nuevos = 0;
      for (const i of lote.trabajos) {
        if (ambitos.has(i.id)) continue;
        const padre =
          i.parentItemId === productoItemId
            ? 'producto'
            : ambitos.get(i.parentItemId!);
        if (padre) {
          ambitos.set(
            i.id,
            i.parentItemId === productoItemId
              ? padre
              : `${padre}/${i.componenteCodigo}`,
          );
          nuevos++;
        }
      }
      if (!nuevos)
        throw new ConflictException(
          'El árbol de producción del lote está incompleto.',
        );
      pendientes -= nuevos;
    }
    const porCodigo = new Map<
      string,
      (typeof lote.trabajos)[number]['pasos'][number]
    >(
      lote.trabajos.flatMap((i) =>
        i.pasos.map((p) => [`${ambitos.get(i.id)}/${p.nodoClave}`, p] as const),
      ),
    );
    const ops = a.operaciones.filter(
      (o) => o.desde === desde && o.hasta === desde + lote.cantidad,
    );
    if (!ops.length || ops.length !== porCodigo.size)
      throw new ConflictException(
        'La ruta del lote no coincide con las operaciones planificadas.',
      );
    for (const o of ops) {
      const p = porCodigo.get(o.operacion),
        t = a.traza.find((t) => t.pasoId === o.id);
      const esperado = o.medicion
        ? o.medicion.preparacionMin + o.medicion.ejecucionMin
        : null;
      if (
        !p ||
        !t ||
        esperado == null ||
        p.duracionEstimadaMin == null ||
        Math.abs(Number(p.duracionEstimadaMin) - esperado) > 0.02
      )
        throw new ConflictException(
          'Los tiempos ejecutables del lote difieren de la propuesta. Revisá su configuración.',
        );
      const inicio = new Date(t.inicio);
      if (!Number.isFinite(inicio.getTime()))
        throw new ConflictException(
          'El lote no tiene un inicio estimado válido.',
        );
      mapa.set(o.id, p.id);
      if (
        lote.revision.aplicadaEl ||
        plan?.reprogramacionAplicadaRevisionId === lote.revisionId
      )
        continue;
      await tx.ordenTrabajoItemPaso.update({
        where: { id: p.id, tenantId },
        data: { planificadoDesde: inicio },
        select: { id: true },
      });
    }
    desde += lote.cantidad;
  }
  if (plan && lotes.length)
    await aplicarReprogramacion(tx, tenantId, productoItemId, mapa);
}
