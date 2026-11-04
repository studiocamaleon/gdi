import { normalizarRut } from './rut';

describe('RUT chileno', () => {
  it.each([
    ['12.345.678-5', '12345678-5'],
    ['123456785', '12345678-5'],
    [' 12.345.678-5 ', '12345678-5'],
    ['1.000.005-k', '1000005-K'],
    ['1000005K', '1000005-K'],
    ['1.000.004-1', '1000004-1'],
    ['99.000.005-0', '99000005-0'],
  ])('normaliza %s y conserva su verificador', (entrada, esperado) => {
    expect(normalizarRut(entrada)).toBe(esperado);
  });
  it.each([
    '',
    '0-0',
    '00000000-0',
    '12.345.678-9',
    'K12345678',
    '12345678A5',
    '12345678--5',
    '12.34.5678-5',
    '12.345.678-5extra',
    '123456789-2',
  ])('rechaza el documento inválido %s', (entrada) => {
    expect(normalizarRut(entrada)).toBeNull();
  });
});
