import { Prisma } from '@prisma/client';
export const ESTADOS_COMPRA_ABIERTA = ['EMITIDA', 'PARCIAL'];
export const ESTADOS_COMPROMISO_COMPRA = [
  'BORRADOR',
  ...ESTADOS_COMPRA_ABIERTA,
];
export function coberturaVigente(
  c: {
    revision: string;
    cantidad: Prisma.Decimal;
    recibida: Prisma.Decimal;
    necesidad: { revision: string; estado: string; orden: { estado: string } };
    linea: {
      cantidad: Prisma.Decimal;
      recibida: Prisma.Decimal;
      orden: { estado: string };
    };
  },
  incluirBorrador = false,
) {
  return c.revision === c.necesidad.revision &&
    c.necesidad.estado === 'ACTIVA' &&
    ['pendiente', 'produccion'].includes(c.necesidad.orden.estado) &&
    (incluirBorrador
      ? ESTADOS_COMPROMISO_COMPRA
      : ESTADOS_COMPRA_ABIERTA
    ).includes(c.linea.orden.estado) &&
    c.linea.cantidad.gt(c.linea.recibida)
    ? Prisma.Decimal.max(0, c.cantidad.minus(c.recibida))
    : new Prisma.Decimal(0);
}
export async function comprasPorNecesidad(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ids: string[],
  incluirBorrador = false,
) {
  const rows = await tx.coberturaCompra.findMany({
    where: {
      tenantId,
      linea: { coberturas: { some: { tenantId, necesidadId: { in: ids } } } },
    },
    include: {
      necesidad: {
        include: { reservas: true, orden: { select: { estado: true } } },
      },
      linea: {
        include: {
          orden: { select: { id: true, numero: true, estado: true } },
        },
      },
    },
  });
  const map = new Map<
    string,
    {
      cantidad: Prisma.Decimal;
      compras: Array<{
        ordenId: string;
        numero: number;
        cantidad: number;
        fecha: string | null;
        confirmada: boolean;
        estado: string;
      }>;
    }
  >();
  const saldoLinea = new Map<string, Prisma.Decimal>();
  const saldoNecesidad = new Map<string, Prisma.Decimal>();
  const solicitadas = new Set(ids);
  rows.sort(
    (a, b) =>
      Number(a.linea.orden.estado === 'BORRADOR') -
        Number(b.linea.orden.estado === 'BORRADOR') ||
      a.linea.orden.numero - b.linea.orden.numero ||
      a.necesidad.createdAt.getTime() - b.necesidad.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  for (const c of rows) {
    const saldo =
      saldoLinea.get(c.lineaId) ??
      Prisma.Decimal.max(
        0,
        c.linea.cantidad.minus(c.linea.recibida).mul(c.linea.factorStock),
      );
    const necesidadPendiente =
      saldoNecesidad.get(c.necesidadId) ??
      Prisma.Decimal.max(
        0,
        c.necesidad.cantidad
          .minus(c.necesidad.consumida)
          .minus(
            c.necesidad.reservas.reduce(
              (a, r) => a.plus(r.cantidad),
              new Prisma.Decimal(0),
            ),
          ),
      );
    const cantidad = Prisma.Decimal.min(
      necesidadPendiente,
      saldo,
      coberturaVigente(c, incluirBorrador),
    );
    saldoLinea.set(c.lineaId, saldo.minus(cantidad));
    saldoNecesidad.set(c.necesidadId, necesidadPendiente.minus(cantidad));
    if (!solicitadas.has(c.necesidadId)) continue;
    if (cantidad.lte(0)) continue;
    const item = map.get(c.necesidadId) ?? {
      cantidad: new Prisma.Decimal(0),
      compras: [],
    };
    item.cantidad = item.cantidad.plus(cantidad);
    item.compras.push({
      ordenId: c.linea.orden.id,
      numero: c.linea.orden.numero,
      cantidad: cantidad.toNumber(),
      fecha:
        (c.linea.fechaConfirmada ?? c.linea.fechaEstimada)
          ?.toISOString()
          .slice(0, 10) ?? null,
      confirmada: !!c.linea.fechaConfirmada,
      estado: c.linea.orden.estado,
    });
    map.set(c.necesidadId, item);
  }
  return map;
}
