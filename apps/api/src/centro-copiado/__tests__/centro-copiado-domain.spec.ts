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
    doc: {
      ...doc,
      paginasOriginales: 20,
      rangoPaginas: '16,1-7,9,12-15',
      archivoNombre: 'Contrato.pdf',
      paginas: 13,
    },
    grupoCargaId: 'carga-1',
    grupoTomoId: null,
    tomoNombre: null,
    terminaciones: [],
    tipoAnillo: null,
    copias: 2,
    papelLabel: 'Obra 80g',
    carillas: 26,
    hojas: 14,
  });
  const tomo = metaTomoCentroCopiado({
    docs: [
      {
        ...doc,
        paginasOriginales: 20,
        rangoPaginas: '16,1-7,9,12-15',
        archivoNombre: 'Contrato.pdf',
        paginas: 13,
      },
    ],
    grupoCargaId: 'carga-1',
    tomoNombre: 'Legajo',
    terminaciones: ['Anillado'],
    tipoAnillo: 'ESPIRAL_PLASTICO',
    juegos: 2,
    hojasPorLibro: 7,
    hojas: 14,
  });

  expect(documento).toMatchObject({
    version: 1,
    esTomo: false,
    nombre: 'Contrato.pdf',
    cobertura: 'normal',
    paginas: 13,
    paginasOriginales: 20,
    rangoPaginas: '1-7,9,12-16',
    archivoNombre: 'Contrato.pdf',
  });
  expect(tomo).toMatchObject({
    version: 1,
    esTomo: true,
    tomoNombre: 'Legajo',
    documentos: 1,
  });
  expect(tomo.segmentos).toHaveLength(1);
  expect(tomo.segmentos?.[0]).toMatchObject({
    paginas: 13,
    paginasOriginales: 20,
    rangoPaginas: '1-7,9,12-16',
    archivoNombre: 'Contrato.pdf',
  });
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
