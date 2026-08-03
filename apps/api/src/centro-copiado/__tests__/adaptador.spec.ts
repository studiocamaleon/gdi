/**
 * Unit test (sin DB) del resolver de variante de papel: el TIPO + GRAMAJE eligen
 * el material; el TAMAÑO define el formato (exacto o el menor que cubra el pliego).
 */
import {
  construirSegmento,
  resolverVariantePapel,
  DocumentoInput,
  PlantillaContexto,
  VariantePapel,
} from '../adaptador';
import { PliegoDim } from '../pliegos';

const variantes: VariantePapel[] = [
  // Papel ilustración: sólo SRA3, tres gramajes.
  {
    id: 'ilu150',
    formatoComercial: 'SRA3',
    anchoMm: 320,
    altoMm: 450,
    gramajeGr: 150,
  },
  {
    id: 'ilu300',
    formatoComercial: 'SRA3',
    anchoMm: 320,
    altoMm: 450,
    gramajeGr: 300,
  },
  // Papel obra: por formato.
  {
    id: 'obraA4',
    formatoComercial: 'A4',
    anchoMm: 210,
    altoMm: 297,
    gramajeGr: 75,
  },
  {
    id: 'obraA3',
    formatoComercial: 'A3',
    anchoMm: 297,
    altoMm: 420,
    gramajeGr: 80,
  },
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

describe('construirSegmento', () => {
  const ctx: PlantillaContexto = {
    productoId: 'p',
    rutaAlternativaId: 'r',
    configPasoId: 'cp',
    maquinaColorId: 'mc',
    maquinaBnId: 'mb',
    cobraSetup: false,
  };
  const baseDoc: DocumentoInput = {
    id: 'd1',
    paginas: 10,
    copias: 1,
    tamano: 'A4',
    tamanoAnchoMm: 210,
    tamanoAltoMm: 297,
    papelMateriaPrimaId: 'mp',
    color: 'COLOR',
    faz: 1,
  };

  it('inyecta la cobertura elegida en el jobContext', () => {
    const seg = construirSegmento(
      { ...baseDoc, cobertura: 'borrador' },
      ctx,
      1,
      'var',
    );
    expect(seg.jobContext.cobertura).toBe('borrador');
  });

  it('sin cobertura declarada → default Alta (centro de copiado)', () => {
    const seg = construirSegmento(baseDoc, ctx, 1, 'var');
    expect(seg.jobContext.cobertura).toBe('alta');
  });

  it('cobraSetup=false → omite setup/limpieza (default)', () => {
    const seg = construirSegmento(baseDoc, ctx, 1, 'var');
    expect(seg.jobContext.omitirSetupCleanup).toBe(true);
  });

  it('cobraSetup=true → el motor NO omite setup/limpieza', () => {
    const seg = construirSegmento(
      baseDoc,
      { ...ctx, cobraSetup: true },
      1,
      'var',
    );
    expect(seg.jobContext.omitirSetupCleanup).toBe(false);
  });

  it('activa tiempo real (sin ceil) para el motor', () => {
    const seg = construirSegmento(baseDoc, ctx, 1, 'var');
    expect(seg.jobContext.tiempoReal).toBe(true);
  });
});
