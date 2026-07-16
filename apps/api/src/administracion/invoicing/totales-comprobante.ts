/**
 * Cálculo de totales de un comprobante. La regla depende de la letra, y es
 * la parte que más fácil se calcula mal:
 *
 * - **A**: el precio es NETO y el IVA se SUMA, discriminado por alícuota.
 *   total = neto + IVA
 * - **B**: el receptor no discrimina IVA. El precio que ve el cliente ya
 *   lo incluye, así que el IVA NO se suma: se extrae del precio para
 *   informarlo. total = precio de lista.
 * - **C**: monotributo/exento no discrimina IVA ni lo tributa por fuera.
 *   El precio es final. total = precio, IVA = 0.
 * - **E**: exportación, exenta. total = precio, IVA = 0.
 */

import type { LetraProvider } from './invoicing-provider';

export type ItemCalculo = {
  cantidad: number;
  precioUnitarioSinIva: number;
  alicuotaIva: number | 'exento' | 'no_gravado';
  bonificacionPct?: number;
};

export type IvaPorAlicuota = {
  alicuota: number;
  base: number;
  monto: number;
};

export type TotalesComprobante = {
  netoGravado: number;
  ivaPorAlicuota: IvaPorAlicuota[];
  ivaTotal: number;
  total: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Base de una línea, ya bonificada. */
function baseLinea(item: ItemCalculo): number {
  const bruto = item.cantidad * item.precioUnitarioSinIva;
  const bonif = (bruto * (item.bonificacionPct ?? 0)) / 100;
  return bruto - bonif;
}

function alicuotaNumero(a: ItemCalculo['alicuotaIva']): number {
  return typeof a === 'number' ? a : 0;
}

export function calcularTotales(
  letra: LetraProvider,
  items: ItemCalculo[],
): TotalesComprobante {
  // C y E no llevan IVA: el precio cargado es el final.
  if (letra === 'C' || letra === 'E') {
    const total = r2(items.reduce((s, it) => s + baseLinea(it), 0));
    return { netoGravado: total, ivaPorAlicuota: [], ivaTotal: 0, total };
  }

  if (letra === 'B') {
    // El precio ya trae el IVA adentro: se extrae para informarlo, no se suma.
    const porAlicuota = new Map<number, { base: number; monto: number }>();
    let total = 0;
    let neto = 0;
    for (const it of items) {
      const conIva = baseLinea(it);
      const ali = alicuotaNumero(it.alicuotaIva);
      const base = ali > 0 ? conIva / (1 + ali / 100) : conIva;
      const iva = conIva - base;
      total += conIva;
      neto += base;
      if (ali > 0) {
        const acc = porAlicuota.get(ali) ?? { base: 0, monto: 0 };
        porAlicuota.set(ali, { base: acc.base + base, monto: acc.monto + iva });
      }
    }
    return {
      netoGravado: r2(neto),
      ivaPorAlicuota: [...porAlicuota.entries()]
        .map(([alicuota, v]) => ({
          alicuota,
          base: r2(v.base),
          monto: r2(v.monto),
        }))
        .sort((a, b) => a.alicuota - b.alicuota),
      ivaTotal: r2(total - neto),
      total: r2(total),
    };
  }

  // A: el IVA se suma al neto, discriminado por alícuota.
  const porAlicuota = new Map<number, { base: number; monto: number }>();
  let neto = 0;
  for (const it of items) {
    const base = baseLinea(it);
    neto += base;
    const ali = alicuotaNumero(it.alicuotaIva);
    if (ali > 0) {
      const acc = porAlicuota.get(ali) ?? { base: 0, monto: 0 };
      porAlicuota.set(ali, {
        base: acc.base + base,
        monto: acc.monto + (base * ali) / 100,
      });
    }
  }
  const lineas = [...porAlicuota.entries()]
    .map(([alicuota, v]) => ({
      alicuota,
      base: r2(v.base),
      monto: r2(v.monto),
    }))
    .sort((a, b) => a.alicuota - b.alicuota);
  const ivaTotal = r2(lineas.reduce((s, l) => s + l.monto, 0));
  return {
    netoGravado: r2(neto),
    ivaPorAlicuota: lineas,
    ivaTotal,
    total: r2(r2(neto) + ivaTotal),
  };
}
