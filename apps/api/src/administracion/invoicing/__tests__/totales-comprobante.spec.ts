import { calcularTotales } from '../totales-comprobante';

const item = (
  cantidad: number,
  precio: number,
  alicuota: number | 'exento' | 'no_gravado' = 21,
  bonificacionPct?: number,
) => ({
  cantidad,
  precioUnitarioSinIva: precio,
  alicuotaIva: alicuota,
  ...(bonificacionPct !== undefined ? { bonificacionPct } : {}),
});

describe('Factura A — el IVA se suma al neto y se discrimina', () => {
  it('suma el IVA sobre el neto', () => {
    const r = calcularTotales('A', [item(1, 1000)]);
    expect(r.netoGravado).toBe(1000);
    expect(r.ivaTotal).toBe(210);
    expect(r.total).toBe(1210);
  });

  it('discrimina por alícuota y las ordena', () => {
    const r = calcularTotales('A', [
      item(1, 1000, 21),
      item(1, 500, 10.5),
      item(2, 100, 21),
    ]);
    expect(r.ivaPorAlicuota).toEqual([
      { alicuota: 10.5, base: 500, monto: 52.5 },
      { alicuota: 21, base: 1200, monto: 252 },
    ]);
    expect(r.netoGravado).toBe(1700);
    expect(r.ivaTotal).toBe(304.5);
    expect(r.total).toBe(2004.5);
  });

  it('multiplica por cantidad', () => {
    const r = calcularTotales('A', [item(3, 250)]);
    expect(r.netoGravado).toBe(750);
    expect(r.total).toBe(907.5);
  });

  it('aplica la bonificación antes del IVA', () => {
    const r = calcularTotales('A', [item(1, 1000, 21, 10)]);
    expect(r.netoGravado).toBe(900);
    expect(r.ivaTotal).toBe(189);
    expect(r.total).toBe(1089);
  });

  it('un ítem exento no genera IVA pero suma al neto', () => {
    const r = calcularTotales('A', [item(1, 1000, 'exento')]);
    expect(r.netoGravado).toBe(1000);
    expect(r.ivaTotal).toBe(0);
    expect(r.ivaPorAlicuota).toEqual([]);
    expect(r.total).toBe(1000);
  });

  it('alícuota 0 no aparece discriminada', () => {
    const r = calcularTotales('A', [item(1, 1000, 0)]);
    expect(r.ivaPorAlicuota).toEqual([]);
    expect(r.total).toBe(1000);
  });
});

describe('Factura B — el IVA ya está incluido en el precio, no se suma', () => {
  it('el total es el precio de lista: NO se le suma IVA', () => {
    const r = calcularTotales('B', [item(1, 1210)]);
    expect(r.total).toBe(1210);
  });

  it('extrae el IVA contenido para informarlo', () => {
    const r = calcularTotales('B', [item(1, 1210)]);
    expect(r.netoGravado).toBe(1000);
    expect(r.ivaTotal).toBe(210);
    expect(r.ivaPorAlicuota).toEqual([
      { alicuota: 21, base: 1000, monto: 210 },
    ]);
  });

  it('neto + IVA reconstruye el total', () => {
    const r = calcularTotales('B', [item(2, 999.99, 21), item(1, 500, 10.5)]);
    expect(r.netoGravado + r.ivaTotal).toBeCloseTo(r.total, 2);
  });

  it('la misma lista de precios da distinto total en A que en B', () => {
    const a = calcularTotales('A', [item(1, 1000)]);
    const b = calcularTotales('B', [item(1, 1000)]);
    expect(a.total).toBe(1210);
    expect(b.total).toBe(1000);
  });
});

describe('Factura C — monotributo: precio final, sin IVA', () => {
  it('no lleva IVA y el total es el precio', () => {
    const r = calcularTotales('C', [item(1, 1000)]);
    expect(r.total).toBe(1000);
    expect(r.ivaTotal).toBe(0);
    expect(r.ivaPorAlicuota).toEqual([]);
  });

  it('ignora la alícuota cargada en el ítem', () => {
    expect(calcularTotales('C', [item(1, 1000, 21)]).total).toBe(1000);
    expect(calcularTotales('C', [item(1, 1000, 10.5)]).total).toBe(1000);
  });

  it('respeta cantidad y bonificación', () => {
    const r = calcularTotales('C', [item(2, 500, 21, 20)]);
    expect(r.total).toBe(800);
  });
});

describe('Factura E — exportación, exenta', () => {
  it('no lleva IVA', () => {
    const r = calcularTotales('E', [item(1, 2400, 21)]);
    expect(r.total).toBe(2400);
    expect(r.ivaTotal).toBe(0);
  });
});

describe('redondeo', () => {
  it('los montos quedan a 2 decimales', () => {
    const r = calcularTotales('A', [item(3, 33.33)]);
    expect(r.netoGravado).toBe(99.99);
    expect(r.ivaTotal).toBe(21);
    expect(r.total).toBe(120.99);
  });

  it('el total de A es exactamente neto + IVA ya redondeados', () => {
    const r = calcularTotales('A', [item(1, 0.05), item(1, 0.05)]);
    expect(r.total).toBe(r2(r.netoGravado + r.ivaTotal));
  });

  it('sin ítems da todo en cero', () => {
    for (const letra of ['A', 'B', 'C', 'E'] as const) {
      const r = calcularTotales(letra, []);
      expect(r.total).toBe(0);
      expect(r.ivaTotal).toBe(0);
    }
  });
});

const r2 = (n: number) => Math.round(n * 100) / 100;
