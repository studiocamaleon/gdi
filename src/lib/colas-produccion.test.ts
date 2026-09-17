import { describe, expect, it } from 'vitest';
import { detallePerfilCola, formatoCola } from './colas-produccion';

describe('sustrato de producción', () => {
  it('distingue placa y pliego mediante el material, aunque ambos sean sheet', () => {
    const formato = [{ tipo: 'sheet' as const, anchoMm: 330, altoMm: 483 }];
    expect(formatoCola(formato, 'SUSTRATO_HOJA')).toBe('Pliego (hoja) · 330 × 483 mm');
    expect(formatoCola(formato, 'SUSTRATO_RIGIDO')).toBe('Placa · 330 × 483 mm');
    expect(formatoCola(formato)).toBe('Formato plano · 330 × 483 mm');
  });
  it('conserva cada ancho previsto de rollo y no inventa dimensiones faltantes', () => {
    expect(formatoCola([{ tipo: 'roll', anchoMm: 1370, altoMm: null }, { tipo: 'roll', anchoMm: 1520, altoMm: null }])).toBe('Rollo · 1,37 m / Rollo · 1,52 m');
    expect(formatoCola([], 'SUSTRATO_RIGIDO')).toBe('Sin dato');
  });
});

describe('detalle visible del perfil en Colas y Preparar tanda', () => {
  it.each([
    ['CMYK', 'CMYK - 4 pass', '4 pass'],
    ['CMYK + blanco', 'CMYK + Blanco - 4 pass', '4 pass'],
    ['CMYK + blanco', 'CMYK+Blanco — Calidad alta', 'Calidad alta'],
    ['CMYK', 'CMYK', null],
    ['CMYK', null, null],
    ['CMYK', 'Calidad alta - 4 pass', 'Calidad alta - 4 pass'],
    ['CMYK', 'CMYK + Blanco - 4 pass', 'CMYK + Blanco - 4 pass'],
    ['CMYK + blanco', 'CMYK - 4 pass', 'CMYK - 4 pass'],
    [null, 'CMYK - 4 pass', 'CMYK - 4 pass'],
  ])('color %s / perfil %s → %s', (modoColor, perfilNombre, esperado) => {
    const configuracion = Object.freeze({ modoColor, perfilNombre });
    expect(detallePerfilCola(configuracion)).toBe(esperado);
  });
});
