import {
  planificarTandasCopiado,
  type DocumentoTanda,
  MAX_BYTES_TANDA,
} from './tandas-copiado';
const documento: DocumentoTanda = {
  id: 'a',
  archivoNombre: 'Prueba.pdf',
  archivoBytes: 1000,
  paginas: 3,
  paginasOriginales: 3,
  copias: 2,
  faz: 2,
  papelMateriaPrimaId: 'papel-ficticio',
  gramaje: 80,
  tamano: 'A4',
  tamanoAnchoMm: 210,
  tamanoAltoMm: 297,
  color: 'COLOR',
  cobertura: 'alta',
};
const entrada = (cambios: Partial<DocumentoTanda> = {}, maquina = 'laser') => ({
  documento: { ...documento, ...cambios },
  maquina,
});
it('une compatibles entre cargas y cuenta copias y dorso de cada original', () => {
  expect(
    planificarTandasCopiado([
      entrada(),
      entrada({ id: 'b', paginas: 1, copias: 3 }),
    ]),
  ).toEqual([{ documentos: ['a', 'b'], paginas: 14, bytes: 2000 }]);
});
it.each([
  { papelMateriaPrimaId: 'otro' },
  { gramaje: 90 },
  { tamano: 'A3' },
  { tamanoAltoMm: 300 },
  { color: 'BN' },
  { cobertura: 'normal' },
  { faz: 1 },
])('separa ajustes distintos %p', (cambios) => {
  expect(
    planificarTandasCopiado([entrada(), entrada({ id: 'b', ...cambios })]),
  ).toHaveLength(2);
});
it('separa máquinas, monedas y pedidos; los tomos, CAD y terminaciones conservan su preparación', () => {
  expect(
    planificarTandasCopiado([entrada(), entrada({ id: 'b' }, 'otra')]),
  ).toHaveLength(2);
  expect(
    planificarTandasCopiado([
      { ...entrada(), contexto: 'ARS' },
      { ...entrada({ id: 'b' }), contexto: 'USD' },
    ]),
  ).toHaveLength(2);
  for (const cambios of [
    { grupoId: 'tomo' },
    { modo: 'CAD' },
    { terminaciones: ['Anillado'] },
    { archivoNombre: 'texto.docx' },
    { archivoBytes: undefined },
  ])
    expect(planificarTandasCopiado([entrada(cambios)])).toEqual([]);
  expect(planificarTandasCopiado([entrada()])[0].documentos).toEqual(['a']);
});
it('divide por los límites reales del PDF y no presume unificación de archivos manuales o enormes', () => {
  expect(
    planificarTandasCopiado([
      entrada({ paginas: 3000, copias: 1 }),
      entrada({ id: 'b', paginas: 3000, copias: 1 }),
    ]),
  ).toHaveLength(2);
  expect(
    planificarTandasCopiado([
      entrada({ archivoBytes: MAX_BYTES_TANDA }),
      entrada({ id: 'b' }),
    ]),
  ).toHaveLength(2);
  expect(
    planificarTandasCopiado([entrada({ paginas: 3000, copias: 2 })]),
  ).toEqual([]);
  expect(
    planificarTandasCopiado([entrada({ archivoNombre: undefined })]),
  ).toEqual([]);
});
