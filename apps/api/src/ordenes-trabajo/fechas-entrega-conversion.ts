import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { claveFechaEnZona, instanteDe, sumarDiasAClave } from '../common/zona';
import { simularFlujo, sumarDiasHabiles } from '../eta/motor/flujo-produccion';
import type { EtaService } from '../eta/eta.service';
import { motivoSinEstacion } from '../eta/motor/tablero-tipos';
import type { PrevisionMaterialesService } from '../inventario/prevision-materiales.service';
import { solicitudDesdeMateriales } from '../inventario/prevision-materiales.proyeccion';
import { bloquearVariantesStock } from '../inventario/stock-reservas';
import { leerMaterialesOrden } from './materiales-orden.consulta';

/** Se ejecuta antes de reservar stock y dentro de la transacción de emisión.
 * La OT ya tiene sus pasos: se simula una sola vez junto con toda la cola actual. */
export async function recalcularFechasConversion(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ordenId: string,
  eta: EtaService,
  prevision: PrevisionMaterialesService,
) {
  const contexto = await eta.contextoSimulacion(tenantId, tx);
  const { materiales } = await leerMaterialesOrden(tx, tenantId, ordenId);
  await bloquearVariantesStock(
    tx,
    tenantId,
    materiales.necesidades.map((n) => n.varianteId),
  );
  const disponibilidad = await prevision.consultar(
    tenantId,
    solicitudDesdeMateriales(materiales),
    contexto.ahora,
    tx,
  );
  const trabajos = contexto.items.filter((i) => i.ordenId === ordenId);
  for (const item of trabajos)
    for (const paso of item.pasos) {
      const motivo = motivoSinEstacion(contexto.estaciones, paso);
      if (motivo)
        throw new BadRequestException(
          `No se emitió la OT: ${item.nombre ?? 'Producto'} · ${paso.nombre}. ${motivo}`,
        );
    }
  const desde =
    disponibilidad.estado === 'requiere_compra' &&
    disponibilidad.disponibleDesde
      ? instanteDe(
          sumarDiasAClave(disponibilidad.disponibleDesde, 1),
          '00:00',
          disponibilidad.zona,
        )
      : null;
  // Sin fechas heredadas: la nueva carga no se adelanta por una promesa vencida.
  for (const item of trabajos) {
    item.fechaEntrega = null;
    if (desde)
      for (const paso of item.pasos) {
        if (!paso.planificadoDesde || new Date(paso.planificadoDesde) < desde)
          paso.planificadoDesde = desde.toISOString();
      }
  }
  const { porItem } = simularFlujo(contexto);
  const items = await tx.ordenTrabajoItem.findMany({
    where: { tenantId, ordenId },
    select: { id: true, nombre: true, parentItemId: true },
  });
  const fechas = new Map<string, string>();
  const pendientes: string[] = [];
  for (const item of items) {
    const resultado = porItem.get(item.id);
    if (resultado?.sinEstimar) {
      pendientes.push(item.nombre);
      continue;
    }
    if (
      resultado?.finEstimado &&
      Number.isFinite(resultado.finEstimado.getTime())
    )
      fechas.set(
        item.id,
        claveFechaEnZona(
          sumarDiasHabiles(
            resultado.finEstimado,
            contexto.margenEtaDias,
            contexto.noLaborables,
            contexto.zona,
          ),
          contexto.zona,
        ),
      );
  }
  // Un producto compuesto se entrega cuando termina su último componente.
  for (let n = 0; n < items.length; n++) {
    let cambio = false;
    for (const item of items) {
      const hijos = items.filter((h) => h.parentItemId === item.id);
      if (!hijos.length || hijos.some((h) => !fechas.has(h.id))) continue;
      const ultima = hijos.reduce(
        (max, h) => (fechas.get(h.id)! > max ? fechas.get(h.id)! : max),
        fechas.get(item.id) ?? '',
      );
      if (fechas.get(item.id) !== ultima) {
        fechas.set(item.id, ultima);
        cambio = true;
      }
    }
    if (!cambio) break;
  }
  for (const item of items)
    if (!fechas.has(item.id)) pendientes.push(item.nombre);
  if (!items.length || pendientes.length)
    throw new BadRequestException(
      `No se emitió la OT: no se puede estimar la entrega completa de ${[...new Set(pendientes)].slice(0, 4).join(', ') || 'sus productos'}. Revisá rutas, tiempos y disponibilidad del taller.`,
    );
  // Las rutas siguen siendo válidas aunque falte confirmar la reposición.
  // No convertir esa incertidumbre en una fecha prometida.
  if (disponibilidad.estado === 'por_confirmar') return null;
  for (const [id, fecha] of fechas)
    await tx.ordenTrabajoItem.update({
      where: { id, tenantId },
      data: { fechaEntrega: new Date(`${fecha}T00:00:00Z`) },
    });
  if (desde)
    await tx.ordenTrabajoItemPaso.updateMany({
      where: {
        tenantId,
        item: { ordenId },
        OR: [{ planificadoDesde: null }, { planificadoDesde: { lt: desde } }],
      },
      data: { planificadoDesde: desde },
    });
  return [...fechas.values()].sort().at(-1)!;
}
