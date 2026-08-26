import {
  calcularEquivalentePuntos,
  calcularPuntosFidelizacion,
} from '../fidelizacion.service';

describe('calcularPuntosFidelizacion', () => {
  const base = {
    porcentajeMargen: 1,
    montoBase: 1000,
    puntosBase: 100,
    acumulacionActiva: true,
  };

  it('calcula sobre el margen y redondea siempre hacia abajo', () => {
    expect(calcularPuntosFidelizacion({ ...base, margen: 19_999 })).toBe(19);
    expect(calcularPuntosFidelizacion({ ...base, margen: 20_000 })).toBe(20);
  });

  it('no acredita por margen nulo o negativo', () => {
    expect(calcularPuntosFidelizacion({ ...base, margen: 0 })).toBe(0);
    expect(calcularPuntosFidelizacion({ ...base, margen: -10_000 })).toBe(0);
  });

  it('no acredita cuando el programa está pausado o la orden canjea', () => {
    expect(
      calcularPuntosFidelizacion({
        ...base,
        margen: 20_000,
        acumulacionActiva: false,
      }),
    ).toBe(0);
    expect(
      calcularPuntosFidelizacion({
        ...base,
        margen: 20_000,
        tieneCanje: true,
      }),
    ).toBe(0);
  });
});

describe('calcularEquivalentePuntos', () => {
  it('convierte los puntos usando la equivalencia monetaria configurada', () => {
    expect(calcularEquivalentePuntos(74, 1000, 100)).toBe(740);
  });

  it('redondea moneda a dos decimales y protege configuraciones inválidas', () => {
    expect(calcularEquivalentePuntos(1, 1000, 300)).toBe(3.33);
    expect(calcularEquivalentePuntos(10, 1000, 0)).toBe(0);
  });
});
