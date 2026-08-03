/**
 * Núcleo de la cobertura de tóner por nivel (Fase 1). El motor multiplica
 * gm2 × área × caras, así que el orden de g/m² por nivel == orden de costo:
 * verificar la elección de columna y el fallback a consumoBase cubre "borrador <
 * alta" y "sin cobertura == consumoBase" sin necesidad de una cotización completa.
 */
import {
  NIVEL_COBERTURA_DEFAULT,
  consumoGm2DeCobertura,
  normalizarNivelCobertura,
} from '../cobertura-toner';

describe('normalizarNivelCobertura', () => {
  it('acepta códigos y labels (case-insensitive)', () => {
    expect(normalizarNivelCobertura('borrador')).toBe('borrador');
    expect(normalizarNivelCobertura('Alta')).toBe('alta');
    expect(normalizarNivelCobertura('NORMAL')).toBe('normal');
  });

  it('mapea sinónimos y el modelo viejo', () => {
    expect(normalizarNivelCobertura('estandar')).toBe('normal');
    expect(normalizarNivelCobertura('full')).toBe('alta');
    expect(normalizarNivelCobertura('draft')).toBe('borrador');
  });

  it('desconocido/ausente → default Normal', () => {
    expect(normalizarNivelCobertura(undefined)).toBe(NIVEL_COBERTURA_DEFAULT);
    expect(normalizarNivelCobertura('xyz')).toBe('normal');
    expect(normalizarNivelCobertura(42)).toBe('normal');
  });
});

describe('consumoGm2DeCobertura', () => {
  const c = {
    consumoBase: 10,
    consumoPorCoberturaJson: { borrador: 3, normal: 10, alta: 20 },
  };

  it('elige la columna del nivel', () => {
    expect(consumoGm2DeCobertura(c, 'borrador')).toBe(3);
    expect(consumoGm2DeCobertura(c, 'normal')).toBe(10);
    expect(consumoGm2DeCobertura(c, 'alta')).toBe(20);
  });

  it('borrador < alta cuando las columnas difieren', () => {
    expect(consumoGm2DeCobertura(c, 'borrador')).toBeLessThan(
      consumoGm2DeCobertura(c, 'alta'),
    );
  });

  it('sin JSON → consumoBase (cero regresión)', () => {
    const legacy = { consumoBase: 7, consumoPorCoberturaJson: null };
    expect(consumoGm2DeCobertura(legacy, 'alta')).toBe(7);
    expect(consumoGm2DeCobertura(legacy, 'borrador')).toBe(7);
  });

  it('columna vacía/no positiva → cae a consumoBase', () => {
    const parcial = {
      consumoBase: 9,
      consumoPorCoberturaJson: { alta: 25 }, // sin borrador/normal
    };
    expect(consumoGm2DeCobertura(parcial, 'alta')).toBe(25);
    expect(consumoGm2DeCobertura(parcial, 'borrador')).toBe(9);
    const cero = { consumoBase: 9, consumoPorCoberturaJson: { alta: 0 } };
    expect(consumoGm2DeCobertura(cero, 'alta')).toBe(9);
  });

  it('acepta valores string en el JSON', () => {
    const str = {
      consumoBase: 10,
      consumoPorCoberturaJson: { normal: '12.5' },
    };
    expect(consumoGm2DeCobertura(str, 'normal')).toBe(12.5);
  });
});
