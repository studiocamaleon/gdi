import { ProductoRutasService } from '../producto-rutas.service';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { CargosDirectosProductoService } from '../cargos-directos-producto.service';
import { resolverEstadosActivacion } from '../../motor-universal/estado-pasos';

const regla = (id: string, estado = 1) => ({
  '==': [{ var: `pasoActivo_${id}` }, estado],
});
const alternativa = {
  id: 'ruta-ficticia',
  productoId: 'producto-ficticio',
  rutaId: 'base-ficticia',
  rutaVersion: 2,
};
const extra = (id: string, cambios = {}) => ({
  id,
  tenantId: 'empresa-ficticia',
  productoId: alternativa.productoId,
  rutaAlternativaId: alternativa.id,
  familiaCodigo: 'trabajo_manual',
  nombreVisible: id,
  modoActivacion: 'OPCIONAL',
  activo: true,
  ...cambios,
});
function escenario(
  extras = [extra('refilado'), extra('troquelado')],
  configs: unknown[] = [],
) {
  const prisma = {
    producto: {
      findFirst: jest.fn().mockResolvedValue({ id: alternativa.productoId }),
    },
    familiaPasoDefaults: { findUnique: jest.fn().mockResolvedValue(null) },
    productoRutaAlternativa: {
      findFirst: jest.fn().mockResolvedValue(alternativa),
    },
    rutaPaso: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 'impresion', familiaCodigo: 'impresion_area' },
        ]),
    },
    productoConfigPaso: {
      findMany: jest.fn().mockResolvedValue(configs),
      aggregate: jest.fn().mockResolvedValue({ _max: { ordenFlujo: 0 } }),
    },
    productoPasoExtra: {
      findFirst: jest
        .fn()
        .mockImplementation(({ where }) =>
          Promise.resolve(extras.find((p) => p.id === where.id)),
        ),
      findMany: jest.fn().mockResolvedValue(extras),
      aggregate: jest.fn().mockResolvedValue({ _max: { ordenFlujo: 2 } }),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      delete: jest.fn(),
    },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback(prisma),
  };
  const servicio = new CargosDirectosProductoService(
    prisma as never,
    { assertFamiliaExiste: jest.fn() } as never,
    capacidadesDePrueba(),
  );
  return { prisma, servicio };
}

describe('Estado de otros pasos agregados al producto', () => {
  it.each([0, 1])(
    'guarda y calcula Refilado según Troquelado esté en estado %s, aunque venga después',
    async (estado) => {
      const { servicio, prisma } = escenario();
      const condicionActivacionJson = regla('troquelado', estado);
      await servicio.actualizarPasoExtra('empresa-ficticia', 'refilado', {
        modoActivacion: 'CONDICIONAL',
        condicionActivacionJson,
      });
      expect(prisma.productoPasoExtra.update).toHaveBeenCalledWith({
        where: { id: 'refilado' },
        data: { modoActivacion: 'CONDICIONAL', condicionActivacionJson },
      });
      const pasos = [
        {
          rutaPasoId: 'refilado',
          configPasoId: 'refilado',
          modoActivacion: 'CONDICIONAL',
          condicionActivacionJson,
        },
        {
          rutaPasoId: 'troquelado',
          configPasoId: 'troquelado',
          modoActivacion: 'OPCIONAL',
        },
      ];
      for (const activado of [false, true]) {
        expect(
          resolverEstadosActivacion(pasos, {
            opcionalesActivados: { troquelado: activado },
          }).get('refilado'),
        ).toMatchObject({ activado: Number(activado) === estado });
      }
      expect(prisma.productoPasoExtra.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'empresa-ficticia',
          rutaAlternativaId: alternativa.id,
          activo: true,
        },
      });
    },
  );
  it('valida también la condición al crear el extra', async () => {
    const { servicio, prisma } = escenario();
    await servicio.agregarPasoExtra(
      'empresa-ficticia',
      alternativa.productoId,
      {
        rutaAlternativaId: alternativa.id,
        familiaCodigo: 'trabajo_manual',
        ordenInterno: 3,
        modoActivacion: 'CONDICIONAL',
        condicionActivacionJson: regla('troquelado'),
      },
    );
    expect(prisma.productoPasoExtra.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        condicionActivacionJson: regla('troquelado'),
      }),
    });
  });
  it.each(['refilado', 'paso-otra-ruta'])(
    'rechaza el paso propio o ajeno: %s, sin guardar',
    async (destino) => {
      const { servicio, prisma } = escenario();
      await expect(
        servicio.actualizarPasoExtra('empresa-ficticia', 'refilado', {
          modoActivacion: 'CONDICIONAL',
          condicionActivacionJson: regla(destino),
        }),
      ).rejects.toThrow(destino === 'refilado' ? 'circular' : 'misma ruta');
      expect(prisma.productoPasoExtra.update).not.toHaveBeenCalled();
    },
  );
  it('rechaza un ciclo entre extras', async () => {
    const { servicio, prisma } = escenario([
      extra('refilado'),
      extra('troquelado', {
        modoActivacion: 'CONDICIONAL',
        condicionActivacionJson: regla('refilado'),
      }),
    ]);
    await expect(
      servicio.actualizarPasoExtra('empresa-ficticia', 'refilado', {
        modoActivacion: 'CONDICIONAL',
        condicionActivacionJson: regla('troquelado'),
      }),
    ).rejects.toThrow('circular');
    expect(prisma.productoPasoExtra.update).not.toHaveBeenCalled();
  });
  it.each(['borrar', 'desactivar'])(
    'impide %s un extra utilizado por la condición de un paso base',
    async (accion) => {
      const { servicio, prisma } = escenario(undefined, [
        {
          rutaPasoId: 'impresion',
          modoActivacion: 'CONDICIONAL',
          condicionActivacionJson: regla('troquelado'),
        },
      ]);
      await expect(
        accion === 'borrar'
          ? servicio.eliminarPasoExtra('empresa-ficticia', 'troquelado')
          : servicio.actualizarPasoExtra('empresa-ficticia', 'troquelado', {
              activo: false,
            }),
      ).rejects.toThrow('misma ruta');
      expect(prisma.productoPasoExtra.delete).not.toHaveBeenCalled();
      expect(prisma.productoPasoExtra.update).not.toHaveBeenCalled();
    },
  );
});

// Al duplicar una alternativa, las condiciones deben usar los extras de la copia.
it('duplica la alternativa conservando las relaciones base → extra → extra', async () => {
  const origen = {
    ...alternativa,
    nombre: 'Original',
    orden: 0,
    ruta: { nombre: 'Base', pasos: [{ id: 'impresion', version: 2 }] },
    configPasos: [
      {
        rutaPasoId: 'impresion',
        modoActivacion: 'CONDICIONAL',
        condicionActivacionJson: regla('refilado'),
        slotsMateriales: [],
        maquinasCandidatas: [],
        cargosDirectosPaso: [],
      },
    ],
    pasosExtras: [
      extra('refilado', {
        modoActivacion: 'CONDICIONAL',
        condicionActivacionJson: regla('troquelado', 0),
      }),
      extra('troquelado'),
    ],
  };
  const configCreate = jest.fn().mockResolvedValue({ id: 'config-copia' });
  const extraCreate = jest.fn();
  const prisma = {
    productoRutaAlternativa: {
      findFirst: jest.fn().mockResolvedValue(origen),
      aggregate: jest.fn().mockResolvedValue({ _max: { orden: 0 } }),
      create: jest.fn().mockResolvedValue({ id: 'alternativa-copia' }),
    },
    productoConfigPaso: { create: configCreate },
    productoPasoExtra: { createMany: extraCreate },
    $transaction: async (callback: (tx: unknown) => unknown) =>
      callback(prisma),
  };
  const servicio = new ProductoRutasService(
    prisma as never,
    {} as never,
    capacidadesDePrueba(),
  );
  await servicio.duplicarProductoRutaAlternativa(
    'empresa-ficticia',
    alternativa.id,
    {},
  );
  const [refilado, troquelado] = extraCreate.mock.calls[0][0].data;
  expect(refilado.id).not.toBe('refilado');
  expect(troquelado.id).not.toBe('troquelado');
  expect(refilado.rutaAlternativaId).toBe('alternativa-copia');
  expect(troquelado.rutaAlternativaId).toBe('alternativa-copia');
  expect(configCreate.mock.calls[0][0].data.condicionActivacionJson).toEqual(
    regla(refilado.id),
  );
  expect(refilado.condicionActivacionJson).toEqual(regla(troquelado.id, 0));
});
