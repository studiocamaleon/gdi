import { Prisma } from '@prisma/client';

/** Una OT emitida genera un cargo aunque todavía no haya vencido. */
export const ESTADOS_OT_CON_CARGO = [
  'pendiente',
  'produccion',
  'finalizada',
  'entregada',
];

/** Los comprobantes históricos sin OT representan ventas que no tienen otra
 * contrapartida comercial. Las facturas de una OT NO generan una segunda deuda.
 * Las notas heredan también el vínculo de su comprobante de origen. */
export const HISTORICO_SIN_ORDEN = {
  ordenId: null,
  ordenes: { none: {} },
  OR: [
    { comprobanteOrigenId: null },
    { comprobanteOrigen: { ordenId: null, ordenes: { none: {} } } },
  ],
} satisfies Prisma.ComprobanteWhereInput;

export const HISTORICO_VIGENTE = {
  ...HISTORICO_SIN_ORDEN,
  estado: 'emitido',
  anuladoEl: null,
} satisfies Prisma.ComprobanteWhereInput;

export const redondearSaldo = (n: number) => Math.round(n * 100) / 100;

export const disponibleComercial = (
  bruto: number,
  enOrdenes: number,
  enHistoricos: number,
) => Math.max(0, redondearSaldo(bruto - enOrdenes - enHistoricos));

/** Un peso puede cubrir una OT y su factura, pero no otra venta histórica.
 * Los cobros directos están reservados a su orden, incluso en datos legacy. */
export async function saldoComercialCobro(
  tx: Prisma.TransactionClient,
  tenantId: string,
  cobroId: string,
) {
  const [cobro, historico] = await Promise.all([
    tx.cobro.findFirst({
      where: { id: cobroId, tenantId, anuladoEl: null },
      select: {
        montoBruto: true,
        ordenId: true,
        aplicacionesOrden: { select: { monto: true } },
      },
    }),
    tx.cobroImputacion.aggregate({
      where: {
        tenantId,
        cobroId,
        comprobante: {
          ...HISTORICO_VIGENTE,
          tipo: { in: ['factura', 'nota_debito'] },
        },
      },
      _sum: { monto: true },
    }),
  ]);
  const bruto = Number(cobro?.montoBruto ?? 0);
  const enOrdenes = cobro?.ordenId
    ? bruto
    : redondearSaldo(
        cobro?.aplicacionesOrden.reduce((s, a) => s + Number(a.monto), 0) ?? 0,
      );
  const enHistoricos = Number(historico._sum.monto ?? 0);
  return {
    bruto,
    enOrdenes,
    enHistoricos,
    libre: disponibleComercial(bruto, enOrdenes, enHistoricos),
  };
}
