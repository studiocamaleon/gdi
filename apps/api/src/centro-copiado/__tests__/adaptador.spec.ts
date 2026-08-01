/**
 * Unit test (sin DB) del resolver de variante de papel: el TIPO + GRAMAJE eligen
 * el material; el TAMAÑO define el formato (exacto o el menor que cubra el pliego).
 */
import { resolverVariantePapel, VariantePapel } from '../adaptador';
import { PliegoDim } from '../pliegos';

const variantes: VariantePapel[] = [
  // Papel ilustración: sólo SRA3, tres gramajes.
  { id: 'ilu150', formatoComercial: 'SRA3', anchoMm: 320, altoMm: 450, gramajeGr: 150 },
  { id: 'ilu300', formatoComercial: 'SRA3', anchoMm: 320, altoMm: 450, gramajeGr: 300 },
  // Papel obra: por formato.
  { id: 'obraA4', formatoComercial: 'A4', anchoMm: 210, altoMm: 297, gramajeGr: 75 },
  { id: 'obraA3', formatoComercial: 'A3', anchoMm: 297, altoMm: 420, gramajeGr: 80 },
];

const A4: PliegoDim = { preset: 'A4', anchoMm: 210, altoMm: 297 };
const A3: PliegoDim = { preset: 'A3', anchoMm: 297, altoMm: 420 };
const A2: PliegoDim = { preset: 'A2', anchoMm: 420, altoMm: 594 };

it('el gramaje elegido manda; el tamaño resuelve el formato', () => {
  // Ilustración 300g en A4: no hay A4, SRA3 cubre el pliego A4.
  expect(resolverVariantePapel(variantes, A4, 300)).toBe('ilu300');
  expect(resolverVariantePapel(variantes, A4, 150)).toBe('ilu150');
});

it('sin gramaje, gana el formato exacto', () => {
  expect(resolverVariantePapel(variantes, A4)).toBe('obraA4');
  expect(resolverVariantePapel(variantes, A3)).toBe('obraA3');
});

it('sin formato exacto, cae a la variante de menor área que cubre el pliego', () => {
  // A3 con gramaje 150: sólo ilu150 (SRA3), que cubre A3.
  expect(resolverVariantePapel(variantes, A3, 150)).toBe('ilu150');
});

it('si ninguna variante cubre el pliego → null (no hay fallback)', () => {
  // A2 (420×594) no lo cubre ninguna hoja del pool → no se puede producir.
  expect(resolverVariantePapel(variantes, A2)).toBeNull();
});

it('lista vacía → null', () => {
  expect(resolverVariantePapel([], A4)).toBeNull();
});
