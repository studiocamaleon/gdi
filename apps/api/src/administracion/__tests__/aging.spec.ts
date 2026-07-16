import {
  agingVacio,
  calcularAging,
  diasVencidos,
  totalAging,
  tramoDe,
  vencidoGrave,
} from '../aging';

const HOY = new Date(2026, 6, 16); // 16/07/2026
const haceDias = (n: number) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() - n);
  return d;
};
const enDias = (n: number) => haceDias(-n);

describe('diasVencidos', () => {
  it('vencimiento futuro da negativo', () => {
    expect(diasVencidos(enDias(10), HOY)).toBe(-10);
  });

  it('vence hoy da 0', () => {
    expect(diasVencidos(HOY, HOY)).toBe(0);
  });

  it('cuenta los días vencidos', () => {
    expect(diasVencidos(haceDias(45), HOY)).toBe(45);
  });

  it('ignora la hora del día', () => {
    const manana = new Date(2026, 6, 16, 23, 59);
    const madrugada = new Date(2026, 6, 16, 0, 1);
    expect(diasVencidos(manana, madrugada)).toBe(0);
  });
});

describe('tramoDe — los bordes, que es donde se rompe', () => {
  it('vence hoy todavía no está vencido', () => {
    expect(tramoDe(HOY, HOY)).toBe('a_vencer');
  });

  it('vencimiento futuro es a vencer', () => {
    expect(tramoDe(enDias(1), HOY)).toBe('a_vencer');
    expect(tramoDe(enDias(90), HOY)).toBe('a_vencer');
  });

  it('1 día vencido entra en 0-30', () => {
    expect(tramoDe(haceDias(1), HOY)).toBe('d0_30');
  });

  it('30 días es 0-30 y 31 ya es el tramo siguiente', () => {
    expect(tramoDe(haceDias(30), HOY)).toBe('d0_30');
    expect(tramoDe(haceDias(31), HOY)).toBe('d31_60');
  });

  it('60 es 31-60 y 61 es 61-90', () => {
    expect(tramoDe(haceDias(60), HOY)).toBe('d31_60');
    expect(tramoDe(haceDias(61), HOY)).toBe('d61_90');
  });

  it('90 es 61-90 y 91 cae en +90', () => {
    expect(tramoDe(haceDias(90), HOY)).toBe('d61_90');
    expect(tramoDe(haceDias(91), HOY)).toBe('d90_mas');
  });

  it('sin vencimiento no se asume vencido', () => {
    expect(tramoDe(null, HOY)).toBe('a_vencer');
  });
});

describe('calcularAging', () => {
  it('sin comprobantes da todo en cero', () => {
    expect(calcularAging([], HOY)).toEqual(agingVacio());
  });

  it('reparte cada saldo en su tramo', () => {
    const aging = calcularAging(
      [
        { vencimiento: enDias(10), saldo: 100 },
        { vencimiento: haceDias(15), saldo: 200 },
        { vencimiento: haceDias(45), saldo: 300 },
        { vencimiento: haceDias(75), saldo: 400 },
        { vencimiento: haceDias(120), saldo: 500 },
      ],
      HOY,
    );
    expect(aging).toEqual({
      a_vencer: 100,
      d0_30: 200,
      d31_60: 300,
      d61_90: 400,
      d90_mas: 500,
    });
  });

  it('acumula varios comprobantes en el mismo tramo', () => {
    const aging = calcularAging(
      [
        { vencimiento: haceDias(5), saldo: 100 },
        { vencimiento: haceDias(20), saldo: 50 },
      ],
      HOY,
    );
    expect(aging.d0_30).toBe(150);
  });

  it('una factura cobrada no envejece: saldo 0 no suma', () => {
    const aging = calcularAging(
      [
        { vencimiento: haceDias(200), saldo: 0 },
        { vencimiento: haceDias(200), saldo: 10 },
      ],
      HOY,
    );
    expect(aging.d90_mas).toBe(10);
  });

  it('ignora saldos negativos (una NC no es deuda del cliente)', () => {
    const aging = calcularAging(
      [{ vencimiento: haceDias(100), saldo: -500 }],
      HOY,
    );
    expect(totalAging(aging)).toBe(0);
  });

  it('redondea a 2 decimales', () => {
    const aging = calcularAging(
      [
        { vencimiento: haceDias(5), saldo: 0.005 },
        { vencimiento: haceDias(5), saldo: 0.005 },
      ],
      HOY,
    );
    expect(aging.d0_30).toBe(0.01);
  });
});

describe('totalAging y vencidoGrave', () => {
  const aging = calcularAging(
    [
      { vencimiento: enDias(5), saldo: 1000 },
      { vencimiento: haceDias(10), saldo: 500 },
      { vencimiento: haceDias(70), saldo: 300 },
      { vencimiento: haceDias(100), saldo: 200 },
    ],
    HOY,
  );

  it('el total es la suma de los tramos', () => {
    expect(totalAging(aging)).toBe(2000);
  });

  it('vencidoGrave sólo cuenta lo vencido hace más de 60 días', () => {
    expect(vencidoGrave(aging)).toBe(500);
  });

  it('sin deuda vieja, vencidoGrave es 0', () => {
    const sano = calcularAging([{ vencimiento: enDias(5), saldo: 999 }], HOY);
    expect(vencidoGrave(sano)).toBe(0);
    expect(totalAging(sano)).toBe(999);
  });
});
