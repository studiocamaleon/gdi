import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActualizarCentroCopiadoConfigDto } from '../dto/centro-copiado-config.dto';
import {
  errorOfertaPapel,
  formatoOfrecido,
  formatosProduciblesPorGramaje,
} from '../oferta';
import { CentroCopiadoService } from '../centro-copiado.service';

const papelId = '10000000-0000-4000-8000-000000000001';
const variantes = [
  {
    id: 'obra80',
    formatoComercial: 'A3',
    anchoMm: 297,
    altoMm: 420,
    gramajeGr: 80,
  },
  {
    id: 'obra150',
    formatoComercial: 'A4',
    anchoMm: 210,
    altoMm: 297,
    gramajeGr: 150,
  },
];
const oferta = {
  materiaPrimaId: papelId,
  formatosPorGramaje: [
    { gramaje: 80, tamanos: ['A4', 'A3'] },
    { gramaje: 150, tamanos: ['A4'] },
  ],
};

it('separa posibilidad productiva por gramaje, incluso formatos obtenidos por corte', () => {
  const posible = formatosProduciblesPorGramaje(variantes);
  expect(posible.find((r) => r.gramaje === 80)?.tamanos).toEqual(
    expect.arrayContaining(['A4', 'A3']),
  );
  expect(posible.find((r) => r.gramaje === 150)?.tamanos).toEqual(['A4']);
  expect(errorOfertaPapel(oferta, variantes)).toBeNull();
  expect(
    errorOfertaPapel(
      { ...oferta, formatosPorGramaje: [{ gramaje: 150, tamanos: ['A3'] }] },
      variantes,
    ),
  ).toContain('no se puede producir');
});

it('distingue oferta heredada, vacía y gramaje ausente sin abrir combinaciones', () => {
  expect(
    formatoOfrecido({ materiaPrimaId: papelId }, 80, 'A3', [80, 150]),
  ).toBe(true);
  expect(
    formatoOfrecido({ ...oferta, formatosPorGramaje: [] }, 80, 'A4', [80, 150]),
  ).toBe(false);
  expect(formatoOfrecido(oferta, 150, 'A3', [80, 150])).toBe(false);
  expect(formatoOfrecido(oferta, 150, 'A4', [80])).toBe(false);
  expect(formatoOfrecido(oferta, null, 'A3', [80, 150])).toBe(false);
  expect(
    formatoOfrecido({ ...oferta, gramajes: [80] }, null, 'A3', [80, 150]),
  ).toBe(false);
  expect(formatoOfrecido(oferta, undefined, 'A3', [80])).toBe(true);
  expect(
    formatoOfrecido(
      {
        materiaPrimaId: papelId,
        formatosPorGramaje: [{ gramaje: null, tamanos: ['A4'] }],
      },
      null,
      'A4',
      [null],
    ),
  ).toBe(true);
});

it('rechaza reglas duplicadas y gramajes que no pertenecen al papel', () => {
  expect(
    errorOfertaPapel(
      {
        ...oferta,
        formatosPorGramaje: [
          oferta.formatosPorGramaje[0],
          oferta.formatosPorGramaje[0],
        ],
      },
      variantes,
    ),
  ).toContain('repetir');
  expect(
    errorOfertaPapel(
      { ...oferta, formatosPorGramaje: [{ gramaje: 300, tamanos: ['A4'] }] },
      variantes,
    ),
  ).toContain('no está disponible');
});

it('valida el contrato anidado sin descartar silenciosamente la oferta', async () => {
  const opts = { whitelist: true, forbidNonWhitelisted: true };
  const valido = plainToInstance(ActualizarCentroCopiadoConfigDto, {
    papeles: [oferta],
  });
  expect(await validate(valido, opts)).toEqual([]);
  expect(valido.papeles?.[0].formatosPorGramaje).toEqual(
    oferta.formatosPorGramaje,
  );
  const invalido = plainToInstance(ActualizarCentroCopiadoConfigDto, {
    papeles: [{ ...oferta, formatosPorGramaje: [{ tamanos: ['A4'] }] }],
  });
  expect((await validate(invalido, opts)).length).toBeGreaterThan(0);
});

describe('validación operativa común a cotizar y guardar', () => {
  const config = {
    activo: true,
    papelesJson: [oferta],
    tamanosJson: null,
    terminacionesJson: [],
  };
  const ctx = {
    papeles: [{ materiaPrimaId: papelId, gramajes: [80, 150], variantes }],
    anillos: [],
    tiposAnilloPermitidos: [],
  };
  const doc = {
    id: 'archivo-ficticio',
    paginas: 1,
    copias: 1,
    tamano: 'A3',
    tamanoAnchoMm: 297,
    tamanoAltoMm: 420,
    papelMateriaPrimaId: papelId,
    gramaje: 150,
    color: 'BN',
    faz: 1,
  };
  const db = {
    centroCopiadoConfig: { findUnique: jest.fn(async () => config) },
  };
  const service = new CentroCopiadoService(db as never, {} as never);
  const validar = (documento: unknown, contexto = ctx) =>
    (
      service as unknown as {
        validarOperacion: (
          tenant: string,
          dto: unknown,
          contexto: unknown,
        ) => Promise<void>;
      }
    ).validarOperacion(
      'empresa-ficticia',
      { documentos: [documento] },
      contexto,
    );

  it('rechaza A3 en 150 g aunque A3 esté disponible en 80 g', async () => {
    await expect(validar(doc)).rejects.toThrow('no está ofrecido');
    await expect(validar({ ...doc, gramaje: 80 })).resolves.toBeUndefined();
  });
  it('rechaza omitir gramaje para evitar la restricción', async () => {
    await expect(validar({ ...doc, gramaje: undefined })).rejects.toThrow(
      'no está ofrecido',
    );
  });
  it('una lista general vacía no habilita todos los tamaños', async () => {
    db.centroCopiadoConfig.findUnique.mockResolvedValueOnce({
      ...config,
      tamanosJson: [],
    } as never);
    await expect(validar({ ...doc, gramaje: 80 })).rejects.toThrow(
      'no está habilitado',
    );
  });
  it('no admite un papel ausente del catálogo del tenant', async () => {
    await expect(
      validar({ ...doc, papelMateriaPrimaId: 'papel-otra-empresa' }),
    ).rejects.toThrow('no está habilitado');
  });
});

it('conserva la oferta al actualizar, leer configuración y consultar opciones; rechaza material ajeno antes de escribir', async () => {
  const tenantId = 'empresa-ficticia';
  let guardado = {
    version: 1,
    activo: true,
    papelesJson: null as unknown,
    tamanosJson: null,
    terminacionesJson: [],
  };
  const db = {
    materiaPrima: { count: jest.fn(async () => 1) },
    maquina: { findMany: jest.fn(async () => []) },
    centroCopiadoConfig: {
      findUnique: jest.fn(async () => guardado),
      update: jest.fn(async ({ data }: { data: { papelesJson: unknown } }) => {
        guardado = {
          ...guardado,
          papelesJson: structuredClone(data.papelesJson),
          version: guardado.version + 1,
        };
        return guardado;
      }),
    },
    $transaction: async (fn: (tx: unknown) => Promise<void>) => fn(db),
  };
  const capacidades = {
    exigir: jest.fn(),
    exigirIncluida: jest.fn(),
    incluida: jest.fn(async () => false),
  };
  const service = new CentroCopiadoService(
    db as never,
    {} as never,
    undefined,
    undefined,
    undefined,
    capacidades as never,
  );
  const interno = service as unknown as {
    contexto: () => Promise<unknown>;
    asegurarPlantilla: () => Promise<unknown>;
    aplicarPrecioYTiempos: () => Promise<unknown>;
    preciosYTiemposCC: () => Promise<unknown>;
  };
  jest.spyOn(interno, 'contexto').mockResolvedValue({
    papeles: [
      {
        materiaPrimaId: papelId,
        nombre: 'Obra de prueba',
        gramajes: [80, 150],
        variantes,
      },
    ],
    anillos: [],
    tapas: [],
    tiposAnilloPermitidos: [],
  });
  jest.spyOn(interno, 'asegurarPlantilla').mockResolvedValue(undefined);
  jest.spyOn(interno, 'aplicarPrecioYTiempos').mockResolvedValue(undefined);
  jest.spyOn(interno, 'preciosYTiemposCC').mockResolvedValue({});
  const resultado = await service.actualizarConfig(tenantId, {
    version: 1,
    papeles: [oferta],
  });
  expect(resultado.papeles).toEqual([oferta]);
  expect(
    (await service.opciones(tenantId)).papeles[0].formatosPorGramaje,
  ).toEqual(oferta.formatosPorGramaje);
  expect(
    resultado.disponibles.papeles[0].formatosPorGramaje.find(
      (r) => r.gramaje === 150,
    )?.tamanos,
  ).toEqual(['A4']);
  expect(db.materiaPrima.count).toHaveBeenCalledWith({
    where: { tenantId, id: { in: [papelId] }, subfamilia: 'SUSTRATO_HOJA' },
  });
  db.materiaPrima.count.mockResolvedValueOnce(0);
  await expect(
    service.actualizarConfig(tenantId, {
      papeles: [{ ...oferta, materiaPrimaId: 'material-ajeno' }],
    }),
  ).rejects.toThrow('no pertenece al tenant');
  expect(db.centroCopiadoConfig.update).toHaveBeenCalledTimes(1);
});
