/**
 * Aging: antigüedad del saldo deudor. Lo comparten la cuenta corriente de
 * un cliente y la matriz de deudores.
 *
 * Los tramos son los del diseño: lo que todavía no venció, y después la
 * deuda vencida agrupada por cuántos días hace que venció. Se mide contra
 * el VENCIMIENTO del comprobante (no su fecha de emisión), y sobre el
 * SALDO pendiente (no el total): una factura cobrada no envejece.
 */

export const TRAMOS_AGING = [
  'a_vencer',
  'd0_30',
  'd31_60',
  'd61_90',
  'd90_mas',
] as const;

export type TramoAging = (typeof TRAMOS_AGING)[number];

export const TRAMO_AGING_LABELS: Record<TramoAging, string> = {
  a_vencer: 'A vencer',
  d0_30: '0-30 días',
  d31_60: '31-60',
  d61_90: '61-90',
  d90_mas: '+90',
};

export type Aging = Record<TramoAging, number>;

export function agingVacio(): Aging {
  return { a_vencer: 0, d0_30: 0, d31_60: 0, d61_90: 0, d90_mas: 0 };
}

/** Días vencidos: 0 o negativo = todavía no venció. */
export function diasVencidos(vencimiento: Date, hoy: Date): number {
  const v = Date.UTC(
    vencimiento.getFullYear(),
    vencimiento.getMonth(),
    vencimiento.getDate(),
  );
  const h = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.floor((h - v) / 86_400_000);
}

/**
 * Tramo de un comprobante. Sin vencimiento se considera a vencer: no
 * podemos afirmar que está vencido si nunca se pactó una fecha.
 */
export function tramoDe(vencimiento: Date | null, hoy: Date): TramoAging {
  if (!vencimiento) return 'a_vencer';
  const dias = diasVencidos(vencimiento, hoy);
  if (dias <= 0) return 'a_vencer';
  if (dias <= 30) return 'd0_30';
  if (dias <= 60) return 'd31_60';
  if (dias <= 90) return 'd61_90';
  return 'd90_mas';
}

export type ComprobanteAging = {
  vencimiento: Date | null;
  saldo: number;
};

/** Reparte los saldos en los tramos. */
export function calcularAging(
  comprobantes: ComprobanteAging[],
  hoy: Date,
): Aging {
  const aging = agingVacio();
  for (const c of comprobantes) {
    if (c.saldo <= 0) continue;
    aging[tramoDe(c.vencimiento, hoy)] += c.saldo;
  }
  for (const t of TRAMOS_AGING) {
    aging[t] = Math.round(aging[t] * 100) / 100;
  }
  return aging;
}

export function totalAging(aging: Aging): number {
  return (
    Math.round(TRAMOS_AGING.reduce((s, t) => s + aging[t], 0) * 100) / 100
  );
}

/** Lo vencido hace más de 60 días: el KPI de riesgo del diseño. */
export function vencidoGrave(aging: Aging): number {
  return Math.round((aging.d61_90 + aging.d90_mas) * 100) / 100;
}
