import { describe, expect, it } from 'vitest';
import type { Cobro } from './administracion';
import { montoCobroEnOrden, porcionCobroEnOrden } from './cobro-aplicado';

describe('Cobros compartidos por varias órdenes', () => {
  it('calcula el saldo de la OT con lo aplicado, sin sumar el recibo entero', () => {
    const cobro = { montoBruto: 1000, montoAplicadoOrden: 250 } as Cobro;
    expect(montoCobroEnOrden(cobro)).toBe(250);
    expect(porcionCobroEnOrden(cobro, 40)).toBe(10);
    expect(porcionCobroEnOrden(cobro, 960)).toBe(240);
    expect(porcionCobroEnOrden(cobro, 100)).toBe(25);
    expect(porcionCobroEnOrden(cobro, 860)).toBe(215);
  });
  it('conserva compatibilidad de cobros directos y respeta una aplicación de cero', () => {
    expect(montoCobroEnOrden({ montoBruto: 100 } as Cobro)).toBe(100);
    expect(montoCobroEnOrden({ montoBruto: 100, montoAplicadoOrden: 0 } as Cobro)).toBe(0);
    expect(porcionCobroEnOrden({ montoBruto: 0 } as Cobro, 0)).toBe(0);
  });
});
