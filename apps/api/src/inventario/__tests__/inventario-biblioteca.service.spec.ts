import {
  FamiliaMateriaPrima,
  RolSistema,
  SubfamiliaMateriaPrima,
  UnidadMateriaPrima,
} from '@prisma/client';
import { InventarioBibliotecaService } from '../inventario-biblioteca.service';
import { ModoDuplicadoMaterialPresetDto } from '../dto/install-material-preset.dto';
import type { CurrentAuth } from '../../auth/auth.types';

const auth: CurrentAuth = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  sessionId: 'session-1',
  membershipId: 'membership-1',
  role: RolSistema.ADMINISTRADOR,
  email: 'admin@grafoprint.test',
};

const sheetVariant = {
  id: 'variant-sheet-1',
  presetId: 'preset-sheet',
  skuSugerido: 'OBRA-A4-80-M',
  nombreVarianteSugerido: 'A4 · 80 g/m² · Papel obra · Mate',
  formato: 'A4',
  espesor: null,
  color: 'Blanco',
  recomendada: true,
  atributosVarianteJson: {
    formatoComercial: 'A4',
    ancho: 21,
    alto: 29.7,
    gramaje: 80,
    material: 'Papel obra',
    color: 'Blanco',
    acabado: 'Mate',
    anchoMm: 210,
    altoMm: 297,
    largoMm: 297,
    gramajeGr: 80,
  },
  unidadStock: UnidadMateriaPrima.HOJA,
  unidadCompra: UnidadMateriaPrima.RESMA,
  precioReferencia: null,
  moneda: 'ARS',
  orden: 0,
  activo: true,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
};

const sheetPreset = {
  id: 'preset-sheet',
  key: 'PAPEL_OBRA',
  nombreCanonico: 'Papel obra',
  descripcionCorta: 'Papel blanco no estucado.',
  familia: FamiliaMateriaPrima.SUSTRATO,
  subfamilia: SubfamiliaMateriaPrima.SUSTRATO_HOJA,
  tipoTecnico: 'obra',
  templateId: 'sustrato_hoja_v1',
  iconKind: 'paper',
  aliasDisponiblesJson: ['Papel obra', 'Bond', 'Offset'],
  usosRecomendadosJson: ['impresion_offset'],
  procesosCompatiblesJson: ['impresion_por_hoja'],
  advertenciasJson: [],
  activo: true,
  orden: 100,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  variantes: [sheetVariant],
};

describe('InventarioBibliotecaService', () => {
  it('expone gramaje y familia de presets de sustrato hoja', async () => {
    const prisma = {
      materialPreset: {
        findMany: jest.fn().mockResolvedValue([sheetPreset]),
      },
      materiaPrima: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new InventarioBibliotecaService(prisma as never);

    const [item] = await service.listar(auth);

    expect(item.subfamilia).toBe('sustrato_hoja');
    expect(item.templateId).toBe('sustrato_hoja_v1');
    expect(item.aliasDisponibles).toContain('Bond');
    expect(item.variantes[0]).toMatchObject({
      skuSugerido: 'OBRA-A4-80-M',
      gramaje: 80,
      unidadStock: 'hoja',
      unidadCompra: 'resma',
    });
  });

  it('instala sustrato hoja con unidades y atributos tecnicos del template', async () => {
    const createMateriaPrima = jest.fn().mockResolvedValue({ id: 'mp-1' });
    const createVariante = jest.fn().mockResolvedValue({});
    const prisma = {
      materialPreset: {
        findUnique: jest.fn().mockResolvedValue(sheetPreset),
      },
      materiaPrima: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      materiaPrimaVariante: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (callback) =>
        callback({
          materiaPrima: { create: createMateriaPrima },
          materiaPrimaVariante: { create: createVariante },
        }),
      ),
    };
    const service = new InventarioBibliotecaService(prisma as never);

    await service.instalar(auth, 'PAPEL_OBRA', {
      visibleName: 'Papel obra',
      codigo: 'PAPEL_OBRA',
      descripcion: 'Papel blanco no estucado.',
      aliasUsado: 'Bond',
      variantPresetIds: [sheetVariant.id],
      customVariants: [],
      modoDuplicado: ModoDuplicadoMaterialPresetDto.crear_separado,
    });

    expect(createMateriaPrima).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subfamilia: SubfamiliaMateriaPrima.SUSTRATO_HOJA,
          templateId: 'sustrato_hoja_v1',
          esConsumible: false,
          unidadStock: UnidadMateriaPrima.HOJA,
          unidadCompra: UnidadMateriaPrima.RESMA,
          atributosTecnicosJson: expect.objectContaining({
            formatoComercial: 'A4',
            ancho: 21,
            alto: 29.7,
            gramaje: 80,
            anchoMm: 210,
            altoMm: 297,
            largoMm: 297,
            gramajeGr: 80,
          }),
        }),
      }),
    );
    expect(createVariante).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sku: 'OBRA-A4-80-M',
          unidadStock: UnidadMateriaPrima.HOJA,
          unidadCompra: UnidadMateriaPrima.RESMA,
          atributosVarianteJson: expect.objectContaining({
            gramajeGr: 80,
          }),
        }),
      }),
    );
  });

  it('marca esConsumible al instalar tintas/toner (familia TINTA_COLORANTE)', async () => {
    const createMateriaPrima = jest.fn().mockResolvedValue({ id: 'mp-tinta' });
    const tintaVariant = {
      ...sheetVariant,
      id: 'variant-tinta-1',
      skuSugerido: 'TINTA-ECO-C-1000ML',
      unidadStock: UnidadMateriaPrima.LITRO,
      unidadCompra: UnidadMateriaPrima.LITRO,
    };
    const tintaPreset = {
      ...sheetPreset,
      id: 'preset-tinta',
      key: 'TINTA_ECOSOLVENTE_CMYK',
      familia: FamiliaMateriaPrima.TINTA_COLORANTE,
      subfamilia: SubfamiliaMateriaPrima.TINTA_IMPRESION,
      templateId: 'tinta_impresion_v1',
      variantes: [tintaVariant],
    };
    const prisma = {
      materialPreset: {
        findUnique: jest.fn().mockResolvedValue(tintaPreset),
      },
      materiaPrima: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      materiaPrimaVariante: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (callback) =>
        callback({
          materiaPrima: { create: createMateriaPrima },
          materiaPrimaVariante: { create: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };
    const service = new InventarioBibliotecaService(prisma as never);

    await service.instalar(auth, 'TINTA_ECOSOLVENTE_CMYK', {
      visibleName: 'Tinta ecosolvente CMYK',
      codigo: 'TINTA_ECOSOLVENTE_CMYK',
      descripcion: 'Tinta CMYK.',
      aliasUsado: 'Tinta eco',
      variantPresetIds: [tintaVariant.id],
      customVariants: [],
      modoDuplicado: ModoDuplicadoMaterialPresetDto.crear_separado,
    });

    expect(createMateriaPrima).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ esConsumible: true }),
      }),
    );
  });

  it('instala una copia separada con codigo y SKU desambiguados si ya existen', async () => {
    const createMateriaPrima = jest.fn().mockResolvedValue({ id: 'mp-2' });
    const createVariante = jest.fn().mockResolvedValue({});
    // El código base y el SKU base ya están ocupados (copia previa); recién el
    // primer sufijo queda libre.
    const codigoFindFirst = jest
      .fn()
      .mockResolvedValueOnce({ id: 'mp-1' })
      .mockResolvedValueOnce(null);
    const skuFindFirst = jest
      .fn()
      .mockResolvedValueOnce({ id: 'var-existente' })
      .mockResolvedValue(null);
    const prisma = {
      materialPreset: {
        findUnique: jest.fn().mockResolvedValue(sheetPreset),
      },
      materiaPrima: {
        findMany: jest.fn().mockResolvedValue([{ id: 'mp-1', variantes: [] }]),
        findFirst: codigoFindFirst,
      },
      materiaPrimaVariante: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: skuFindFirst,
      },
      $transaction: jest.fn(async (callback) =>
        callback({
          materiaPrima: { create: createMateriaPrima },
          materiaPrimaVariante: { create: createVariante },
        }),
      ),
    };
    const service = new InventarioBibliotecaService(prisma as never);

    await service.instalar(auth, 'PAPEL_OBRA', {
      visibleName: 'Papel obra premium',
      codigo: 'PAPEL_OBRA',
      descripcion: 'Otra calidad/precio.',
      aliasUsado: 'Bond',
      variantPresetIds: [sheetVariant.id],
      customVariants: [],
      modoDuplicado: ModoDuplicadoMaterialPresetDto.crear_separado,
    });

    expect(createMateriaPrima).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ codigo: 'PAPEL_OBRA-2' }),
      }),
    );
    expect(createVariante).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sku: 'OBRA-A4-80-M-2' }),
      }),
    );
  });
});
