import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { diasDelRango, type Rango } from './periodo';

/**
 * Cobranza — el eje financiero del Panel. Aging de deuda (foto al día de
 * hoy: el saldo pendiente es denormalizado, no reconstruible al pasado),
 * costo de cobrar (comisiones por método de pago — dato que casi ningún
 * software chico da), DSO, cheques en cartera y saldo de cuentas.
 * Ver docs/reportes-plan-backend.md §4.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const MS_DIA = 86_400_000;

type FranjaAging = '0-30' | '31-60' | '61-90' | '+90';
const FRANJAS: FranjaAging[] = ['0-30', '31-60', '61-90', '+90'];

function franjaDe(dias: number): FranjaAging {
  if (dias <= 30) return '0-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return '+90';
}

export type Deudor = {
  clienteId: string | null;
  cliente: string;
  saldo: number;
  diasMax: number;
  porFranja: Record<FranjaAging, number>;
};

export type CostoCobrarMetodo = {
  metodo: string;
  cantidad: number;
  bruto: number;
  comision: number;
  neto: number;
  pct: number;
};

@Injectable()
export class CobranzaService {
  constructor(private readonly prisma: PrismaService) {}

  async finanzas(tenantId: string, rango: Rango, hoy: Date = new Date()) {
    const desde = rango.desde;
    const hastaExcl = new Date(
      rango.hasta.getFullYear(),
      rango.hasta.getMonth(),
      rango.hasta.getDate() + 1,
    );

    const [comprobantesAbiertos, costoRows, factCob, chequeRows, cuentas] =
      await Promise.all([
        // Aging: saldo pendiente HOY (denormalizado) por comprobante.
        this.prisma.comprobante.findMany({
          where: {
            tenantId,
            estado: 'emitido',
            saldoPendiente: { gt: 0 },
          },
          select: {
            fecha: true,
            saldoPendiente: true,
            clienteId: true,
            cliente: { select: { nombre: true } },
          },
        }),
        // Costo de cobrar: comisiones por método, cobros del rango.
        this.prisma.$queryRaw<
          Array<{ metodo: string; cantidad: number; bruto: number; comision: number; neto: number }>
        >`
          SELECT mp.nombre AS metodo, COUNT(*)::int AS cantidad,
                 COALESCE(SUM(co."montoBruto"), 0)::float8 AS bruto,
                 COALESCE(SUM(co."comisionMonto" + co."comisionIvaMonto"), 0)::float8 AS comision,
                 COALESCE(SUM(co."netoAcreditado"), 0)::float8 AS neto
          FROM "Cobro" co
          JOIN "MetodoPago" mp ON mp.id = co."metodoPagoId"
          WHERE co."tenantId" = ${tenantId}::uuid
            AND co.fecha >= ${desde} AND co.fecha < ${hastaExcl}
          GROUP BY mp.nombre
          ORDER BY comision DESC
        `,
        // Facturado (comprobantes) y cobrado (cobros) del período.
        this.prisma.$queryRaw<Array<{ facturado: number; cobrado: number }>>`
          SELECT
            (SELECT COALESCE(SUM(total), 0)::float8 FROM "Comprobante"
              WHERE "tenantId" = ${tenantId}::uuid AND estado = 'emitido'
                AND fecha >= ${desde} AND fecha < ${hastaExcl}) AS facturado,
            (SELECT COALESCE(SUM("montoBruto"), 0)::float8 FROM "Cobro"
              WHERE "tenantId" = ${tenantId}::uuid
                AND fecha >= ${desde} AND fecha < ${hastaExcl}) AS cobrado
        `,
        // Cheques de terceros aún por cobrar (no acreditados ni rechazados).
        this.prisma.valor.findMany({
          where: {
            tenantId,
            origen: 'tercero',
            estado: { in: ['cartera', 'endosado', 'depositado'] },
          },
          select: { estado: true, importe: true, fechaPago: true },
        }),
        this.prisma.cuentaFondos.findMany({
          where: { tenantId },
          select: { nombre: true, saldo: true },
          orderBy: { nombre: 'asc' },
        }),
      ]);

    // ── Aging + deudores ──────────────────────────────────────────────
    const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const aging: Record<FranjaAging, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '+90': 0 };
    const deudoresMap = new Map<string, Deudor>();
    for (const c of comprobantesAbiertos) {
      const saldo = Number(c.saldoPendiente);
      const dias = Math.max(
        0,
        Math.floor((hoyMid.getTime() - c.fecha.getTime()) / MS_DIA),
      );
      const franja = franjaDe(dias);
      aging[franja] += saldo;
      const key = c.clienteId ?? 'sin-cliente';
      let d = deudoresMap.get(key);
      if (!d) {
        d = {
          clienteId: c.clienteId,
          cliente: c.cliente?.nombre ?? 'Sin cliente',
          saldo: 0,
          diasMax: 0,
          porFranja: { '0-30': 0, '31-60': 0, '61-90': 0, '+90': 0 },
        };
        deudoresMap.set(key, d);
      }
      d.saldo += saldo;
      d.diasMax = Math.max(d.diasMax, dias);
      d.porFranja[franja] += saldo;
    }
    const agingTotal = FRANJAS.reduce((a, f) => a + aging[f], 0);
    const vencido = aging['31-60'] + aging['61-90'] + aging['+90'];
    const deudores = [...deudoresMap.values()]
      .map((d) => ({ ...d, saldo: r2(d.saldo) }))
      .sort((a, b) => b.saldo - a.saldo);

    // ── Costo de cobrar ───────────────────────────────────────────────
    const costoCobrar: CostoCobrarMetodo[] = costoRows.map((row) => ({
      metodo: row.metodo,
      cantidad: row.cantidad,
      bruto: r2(row.bruto),
      comision: r2(row.comision),
      neto: r2(row.neto),
      pct: row.bruto > 0 ? r2((row.comision / row.bruto) * 100) : 0,
    }));
    const comisionTotal = costoCobrar.reduce((a, m) => a + m.comision, 0);

    // ── Facturado / cobrado / DSO ────────────────────────────────────
    const facturado = factCob[0]?.facturado ?? 0;
    const cobrado = factCob[0]?.cobrado ?? 0;
    // DSO = días de facturación inmovilizados en la deuda actual.
    const dso =
      facturado > 0 ? r2((agingTotal / facturado) * diasDelRango(rango)) : null;

    // ── Cheques en cartera ────────────────────────────────────────────
    const chequesPorEstado = new Map<string, { cantidad: number; importe: number; prox: Date | null }>();
    for (const v of chequeRows) {
      const e = chequesPorEstado.get(v.estado) ?? { cantidad: 0, importe: 0, prox: null };
      e.cantidad += 1;
      e.importe += Number(v.importe);
      if (v.fechaPago && (!e.prox || v.fechaPago < e.prox)) e.prox = v.fechaPago;
      chequesPorEstado.set(v.estado, e);
    }
    const cheques = [...chequesPorEstado.entries()].map(([estado, e]) => ({
      estado,
      cantidad: e.cantidad,
      importe: r2(e.importe),
      proximoVencimiento: e.prox ? e.prox.toISOString().slice(0, 10) : null,
    }));

    const fondos = cuentas.map((c) => ({ cuenta: c.nombre, saldo: r2(Number(c.saldo)) }));

    return {
      facturado: r2(facturado),
      cobrado: r2(cobrado),
      brecha: r2(facturado - cobrado),
      dso,
      aging: FRANJAS.map((franja) => ({ franja, monto: r2(aging[franja]) })),
      agingTotal: r2(agingTotal),
      vencido: r2(vencido),
      deudores,
      costoCobrar,
      comisionTotal: r2(comisionTotal),
      cheques,
      fondos,
    };
  }

  /** Nota de honestidad para el aging (siempre "al día de hoy"). */
  limites(): string[] {
    return ['Aging por antigüedad de emisión, al día de hoy (el saldo es actual).'];
  }
}
