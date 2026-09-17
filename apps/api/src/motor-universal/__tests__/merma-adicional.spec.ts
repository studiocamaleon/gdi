import { aplicarMermaAdicional } from '../motor.service';

describe('merma adicional de receta', () => {
  it('incrementa una sola vez el consumo ya calculado', () => {
    expect(aplicarMermaAdicional(125, 8)).toBeCloseTo(135, 8);
  });

  it('mantiene compatibilidad cuando no hay merma configurada', () => {
    expect(aplicarMermaAdicional(125, undefined)).toBe(125);
    expect(aplicarMermaAdicional(125, 0)).toBe(125);
  });

  it('ignora valores inválidos o negativos', () => {
    expect(aplicarMermaAdicional(125, 'no-numérico')).toBe(125);
    expect(aplicarMermaAdicional(125, -5)).toBe(125);
  });
});
