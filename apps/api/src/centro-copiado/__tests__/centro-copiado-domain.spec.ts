import {
  errorEstructuraCargaCentroCopiado,
  metaDocumentoCentroCopiado,
  metaTomoCentroCopiado,
} from '../centro-copiado.domain';

const doc = {
  id: 'doc-1',
  nombre: 'Contrato.pdf',
  paginas: 10,
  copias: 2,
  tamano: 'A4',
  tamanoAnchoMm: 210,
  tamanoAltoMm: 297,
  papelMateriaPrimaId: 'papel-1',
  gramaje: 80,
  color: 'BN' as const,
  faz: 2 as const,
  cobertura: 'normal',
};

it('genera metadata versionada y canónica para documento y tomo', () => {
  const documento = metaDocumentoCentroCopiado({
    doc,
    grupoCargaId: 'carga-1',
    grupoTomoId: null,
    tomoNombre: null,
    terminaciones: [],
    tipoAnillo: null,
    copias: 2,
    papelLabel: 'Obra 80g',
    carillas: 20,
    hojas: 10,
  });
  const tomo = metaTomoCentroCopiado({
    docs: [doc],
    grupoCargaId: 'carga-1',
    tomoNombre: 'Legajo',
    terminaciones: ['Anillado'],
    tipoAnillo: 'ESPIRAL_PLASTICO',
    juegos: 2,
    hojasPorLibro: 5,
    hojas: 10,
  });

  expect(documento).toMatchObject({
    version: 1,
    esTomo: false,
    nombre: 'Contrato.pdf',
    cobertura: 'normal',
  });
  expect(tomo).toMatchObject({
    version: 1,
    esTomo: true,
    tomoNombre: 'Legajo',
    documentos: 1,
  });
  expect(tomo.segmentos).toHaveLength(1);
});

it('rechaza referencias huérfanas, tomos vacíos e identidades repetidas', () => {
  expect(
    errorEstructuraCargaCentroCopiado(
      [{ id: 'doc', grupoId: 'inexistente' }],
      [],
    ),
  ).toContain('tomo inexistente');
  expect(
    errorEstructuraCargaCentroCopiado([{ id: 'doc' }], [{ id: 'vacio' }]),
  ).toContain('está vacío');
  expect(
    errorEstructuraCargaCentroCopiado([{ id: 'doc' }, { id: 'doc' }]),
  ).toContain('documentos repetidos');
});
