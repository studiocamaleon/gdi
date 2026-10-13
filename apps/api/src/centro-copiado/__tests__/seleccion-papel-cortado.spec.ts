import { seleccionarPapelesCortados } from '../seleccion-papel-cortado';
import { resolverVariantePapel, type DocumentoInput } from '../adaptador';
const doc = (
  paginas: number,
  extras: Partial<DocumentoInput> = {},
): DocumentoInput => ({
  id: 'doc',
  paginas,
  copias: 1,
  faz: 1,
  color: 'BN',
  gramaje: 180,
  tamano: 'A4',
  tamanoAnchoMm: 210,
  tamanoAltoMm: 297,
  papelMateriaPrimaId: 'opalina',
  ...extras,
});
const papeles = () => [
  {
    materiaPrimaId: 'opalina',
    variantes: [
      {
        id: 'pliego',
        anchoMm: 650,
        altoMm: 950,
        gramajeGr: 180,
        formatoComercial: 'Plana',
      },
      {
        id: 'cortada',
        anchoMm: 210,
        altoMm: 297,
        gramajeGr: 180,
        formatoComercial: 'A4',
        origenDerivadoId: 'pliego',
        stockLibre: 8,
      },
    ],
  },
];
const elegido = (p: ReturnType<typeof papeles>, anchoMm = 210, altoMm = 297) =>
  resolverVariantePapel(p[0].variantes, { preset: 'A4', anchoMm, altoMm }, 180);
it.each([1, 5])('reutiliza remanentes suficientes para %s A4', (n) => {
  const p = papeles();
  seleccionarPapelesCortados(p, { documentos: [doc(n)] }, false);
  expect(elegido(p)).toBe('cortada');
});
it('no promete las mismas ocho A4 a dos documentos de cinco hojas', () => {
  const p = papeles();
  seleccionarPapelesCortados(
    p,
    { documentos: [doc(5), doc(5, { id: 'b' })] },
    false,
  );
  expect(elegido(p)).toBe('pliego');
});
it('incluye la merma en hojas enteras antes de ofrecer el remanente', () => {
  const p = papeles();
  seleccionarPapelesCortados(p, { documentos: [doc(8)] }, false, undefined, 2);
  expect(elegido(p)).toBe('pliego');
  const suficiente = papeles();
  seleccionarPapelesCortados(
    suficiente,
    { documentos: [doc(7)] },
    false,
    undefined,
    2,
  );
  expect(elegido(suficiente)).toBe('cortada');
});
it('considera juegos del tomo, doble faz y reservas ya descontadas', () => {
  const p = papeles();
  seleccionarPapelesCortados(
    p,
    {
      documentos: [doc(3, { faz: 2, grupoId: 'tomo' })],
      grupos: [{ id: 'tomo', juegos: 5 }],
    },
    false,
  );
  expect(elegido(p)).toBe('pliego');
  p[0].variantes[1] = { ...papeles()[0].variantes[1], stockLibre: 0 };
  seleccionarPapelesCortados(p, { documentos: [doc(1)] }, false);
  expect(elegido(p)).toBe('pliego');
});
it('Tarifarios usa reposición y la OT guardada conserva la variante cotizada aunque cambie stock', () => {
  const p = papeles();
  seleccionarPapelesCortados(p, { documentos: [doc(1)] }, true);
  expect(elegido(p)).toBe('pliego');
  const guardada = papeles();
  guardada[0].variantes[1].stockLibre = 0;
  seleccionarPapelesCortados(
    guardada,
    { documentos: [doc(5)] },
    false,
    new Set(['cortada']),
  );
  expect(elegido(guardada)).toBe('cortada');
  const original = papeles();
  seleccionarPapelesCortados(
    original,
    { documentos: [doc(1)] },
    false,
    new Set(['pliego']),
  );
  expect(elegido(original)).toBe('pliego');
});
it('las hojas cortadas no representan pliegos reconstruibles ni retazos de otro tamaño', () => {
  expect(elegido(papeles(), 148, 210)).toBe('pliego');
  expect(elegido(papeles(), 320, 450)).toBe('pliego');
});
