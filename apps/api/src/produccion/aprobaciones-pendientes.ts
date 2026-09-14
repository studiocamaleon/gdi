import type { Prisma } from '@prisma/client';
import { gateDocumentoEstaCumplido } from '../desarrollo-documental/desarrollo-documental.service';

type ReferenciaPaso = {
  id: string;
  ordenId: string;
  itemId: string;
  item: { parentItemId?: string | null; loteEntregaId?: string | null };
};

/** Misma lectura para Lista y Colas, por lote de pasos y con aislamiento de tenant. */
export async function leerAprobacionesPendientes(
  db: Prisma.TransactionClient,
  tenantId: string,
  pasos: ReferenciaPaso[],
): Promise<Map<string, string[]>> {
  if (!pasos.length) return new Map();
  const ordenIds = [...new Set(pasos.map((p) => p.ordenId))];
  const gates = await db.gateProduccionDocumento.findMany({
    where: { tenantId, ordenId: { in: ordenIds }, activo: true },
    select: {
      ordenId: true,
      ordenItemId: true,
      pasoId: true,
      alcance: true,
      nombre: true,
      tipoAprobacion: true,
      archivoMaestro: {
        select: {
          revisionLiberada: {
            select: {
              solicitudes: {
                where: { estado: 'APROBADA' },
                select: { tipo: true },
              },
            },
          },
        },
      },
    },
  });
  const pendientes = gates.filter((g) => !gateDocumentoEstaCumplido(g));
  if (!pendientes.length) return new Map();
  const padres = pasos.some((p) => p.item.loteEntregaId)
    ? await db.ordenTrabajoItem.findMany({
        where: { tenantId, ordenId: { in: ordenIds } },
        select: { id: true, parentItemId: true },
      })
    : [];
  const padresPorId = new Map(padres.map((p) => [p.id, p.parentItemId]));
  const porOrden = new Map<string, typeof pendientes>();
  for (const gate of pendientes) {
    const grupo = porOrden.get(gate.ordenId) ?? [];
    grupo.push(gate);
    porOrden.set(gate.ordenId, grupo);
  }
  return new Map(
    pasos.map((p) => {
      const ambitos = new Set([p.itemId]);
      if (p.item.loteEntregaId) {
        let padre = p.item.parentItemId;
        while (padre && !ambitos.has(padre)) {
          ambitos.add(padre);
          padre = padresPorId.get(padre) ?? null;
        }
      }
      const nombres = (porOrden.get(p.ordenId) ?? [])
        .filter(
          (g) =>
            g.alcance === 'ORDEN' ||
            (g.alcance === 'PASO' && g.pasoId === p.id) ||
            (g.alcance === 'ITEM' &&
              g.ordenItemId &&
              ambitos.has(g.ordenItemId)),
        )
        .map((g) => g.nombre);
      return [p.id, nombres];
    }),
  );
}
