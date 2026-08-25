import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { CargosDirectosProductoService } from '../cargos-directos-producto.service';
import type { FamiliasPasosService } from '../familias-pasos.service';
import { ModoActivacionCargoDto } from '../dto/cargo-directo.dto';

const cargo = {
  id: '22222222-2222-4222-8222-222222222222',
  activo: true,
  nombre: 'Peaje',
  modoCalculo: 'MONTO_FIJO_PLANO',
  modosActivacionSoportados: ['OBLIGATORIO', 'OPCIONAL'],
  configJson: { monto: 2500 },
};

function serviceCon(
  prisma: Record<string, unknown>,
  familias: Partial<FamiliasPasosService> = {},
) {
  return new CargosDirectosProductoService(
    prisma as unknown as PrismaService,
    familias as FamiliasPasosService,
  );
}

describe('CargosDirectosProductoService', () => {
  it('asocia un costo activo y válido a un paso', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'asociacion' });
    const service = serviceCon({
      productoConfigPaso: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'config-paso', paramsPasoJson: null }),
      },
      cargoDirectoCatalogo: { findFirst: jest.fn().mockResolvedValue(cargo) },
      productoCargoDirectoPaso: { create },
    });

    await service.asociarCargoPaso('tenant', 'config-paso', {
      cargoDirectoCatalogoId: cargo.id,
      modoActivacion: ModoActivacionCargoDto.OBLIGATORIO,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productoConfigPasoId: 'config-paso',
        cargoDirectoCatalogoId: cargo.id,
        nivelCodigo: null,
        modoActivacion: 'OBLIGATORIO',
        aplicaMargenOverride: null,
      }),
    });
  });

  it('permite sobrescribir la política de margen al asociar', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'asociacion' });
    const service = serviceCon({
      productoConfigPaso: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'config-paso', paramsPasoJson: null }),
      },
      cargoDirectoCatalogo: { findFirst: jest.fn().mockResolvedValue(cargo) },
      productoCargoDirectoPaso: { create },
    });

    await service.asociarCargoPaso('tenant', 'config-paso', {
      cargoDirectoCatalogoId: cargo.id,
      modoActivacion: ModoActivacionCargoDto.OBLIGATORIO,
      aplicaMargenOverride: false,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ aplicaMargenOverride: false }),
    });
  });

  it('rechaza un modo que el costo no soporta', async () => {
    const service = serviceCon({
      productoConfigPaso: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'config-paso', paramsPasoJson: null }),
      },
      cargoDirectoCatalogo: { findFirst: jest.fn().mockResolvedValue(cargo) },
      productoCargoDirectoPaso: { create: jest.fn() },
    });

    await expect(
      service.asociarCargoPaso('tenant', 'config-paso', {
        cargoDirectoCatalogoId: cargo.id,
        modoActivacion: ModoActivacionCargoDto.CONDICIONAL,
        condicionActivacionJson: { '>': [{ var: 'cantidad' }, 10] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza una regla condicional JsonLogic mal formada', async () => {
    const service = serviceCon({
      productoConfigPaso: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'config-paso', paramsPasoJson: null }),
      },
      cargoDirectoCatalogo: {
        findFirst: jest.fn().mockResolvedValue({
          ...cargo,
          modosActivacionSoportados: ['CONDICIONAL'],
        }),
      },
      productoCargoDirectoPaso: { create: jest.fn() },
    });

    await expect(
      service.asociarCargoPaso('tenant', 'config-paso', {
        cargoDirectoCatalogoId: cargo.id,
        modoActivacion: ModoActivacionCargoDto.CONDICIONAL,
        condicionActivacionJson: { operador_inexistente: [1] },
      }),
    ).rejects.toThrow('regla de activación');
  });

  it('rechaza un monto fijo sin importe positivo', async () => {
    const service = serviceCon({
      productoConfigPaso: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'config-paso', paramsPasoJson: null }),
      },
      cargoDirectoCatalogo: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...cargo, configJson: { monto: 0 } }),
      },
      productoCargoDirectoPaso: { create: jest.fn() },
    });

    await expect(
      service.asociarCargoPaso('tenant', 'config-paso', {
        cargoDirectoCatalogoId: cargo.id,
        modoActivacion: ModoActivacionCargoDto.OBLIGATORIO,
      }),
    ).rejects.toThrow('necesita un monto');
  });

  it('exige elegir un nivel cuando el paso está configurado por niveles', async () => {
    const service = serviceCon({
      productoConfigPaso: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'config-paso',
          paramsPasoJson: {
            niveles: {
              opciones: [
                { codigo: 'simple', nombre: 'Simple', esDefault: true },
                { codigo: 'complejo', nombre: 'Complejo' },
              ],
            },
          },
        }),
      },
      cargoDirectoCatalogo: { findFirst: jest.fn().mockResolvedValue(cargo) },
      productoCargoDirectoPaso: { create: jest.fn() },
    });

    await expect(
      service.asociarCargoPaso('tenant', 'config-paso', {
        cargoDirectoCatalogoId: cargo.id,
        modoActivacion: ModoActivacionCargoDto.OBLIGATORIO,
      }),
    ).rejects.toThrow('elegí en cuál');
  });

  it('asocia el costo únicamente al nivel elegido', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'asociacion' });
    const service = serviceCon({
      productoConfigPaso: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'config-paso',
          paramsPasoJson: {
            niveles: {
              opciones: [
                { codigo: 'simple', nombre: 'Simple', esDefault: true },
                { codigo: 'complejo', nombre: 'Complejo' },
              ],
            },
          },
        }),
      },
      cargoDirectoCatalogo: { findFirst: jest.fn().mockResolvedValue(cargo) },
      productoCargoDirectoPaso: { create },
    });

    await service.asociarCargoPaso('tenant', 'config-paso', {
      cargoDirectoCatalogoId: cargo.id,
      nivelCodigo: 'complejo',
      modoActivacion: ModoActivacionCargoDto.OBLIGATORIO,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ nivelCodigo: 'complejo' }),
    });
  });

  it('permite volver al valor heredado quitando el override', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'asociacion' });
    const service = serviceCon({
      productoCargoDirectoPaso: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'asociacion',
          modoActivacion: 'OPCIONAL',
          condicionActivacionJson: null,
          configOverrideJson: { monto: 9000 },
          cargoDirectoCatalogo: cargo,
        }),
        update,
      },
    });

    await service.actualizarCargoPaso('tenant', 'asociacion', {
      configOverrideJson: null,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'asociacion' },
      data: expect.objectContaining({ configOverrideJson: expect.anything() }),
    });
  });

  it('guarda cargos por nivel en un paso extra', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'paso-extra' });
    const service = serviceCon({
      productoPasoExtra: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'paso-extra',
          maquinaM1Id: null,
          perfilM1Id: null,
          centroCostoId: null,
          paramsPasoJson: {
            niveles: {
              opciones: [
                { codigo: 'simple', nombre: 'Simple', esDefault: true },
                { codigo: 'complejo', nombre: 'Complejo' },
              ],
            },
          },
          configCargosDirectosJson: [],
        }),
        update,
      },
      cargoDirectoCatalogo: {
        findMany: jest.fn().mockResolvedValue([cargo]),
      },
    });

    await service.actualizarPasoExtra('tenant', 'paso-extra', {
      configCargosDirectosJson: [
        {
          cargoDirectoCatalogoId: cargo.id,
          nivelCodigo: 'complejo',
          modoActivacion: 'OPCIONAL',
        },
      ],
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'paso-extra' },
      data: expect.objectContaining({
        configCargosDirectosJson: expect.anything(),
      }),
    });
  });

  it('impide cargos generales en un paso extra que tiene niveles', async () => {
    const service = serviceCon({
      productoPasoExtra: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'paso-extra',
          maquinaM1Id: null,
          perfilM1Id: null,
          centroCostoId: null,
          paramsPasoJson: {
            niveles: {
              opciones: [
                { codigo: 'simple', nombre: 'Simple', esDefault: true },
                { codigo: 'complejo', nombre: 'Complejo' },
              ],
            },
          },
          configCargosDirectosJson: [],
        }),
        update: jest.fn(),
      },
      cargoDirectoCatalogo: {
        findMany: jest.fn().mockResolvedValue([cargo]),
      },
    });

    await expect(
      service.actualizarPasoExtra('tenant', 'paso-extra', {
        configCargosDirectosJson: [
          {
            cargoDirectoCatalogoId: cargo.id,
            modoActivacion: 'OPCIONAL',
          },
        ],
      }),
    ).rejects.toThrow('elegí en cuál');
  });

  it('materializa la configuración base del sistema al crear un paso extra', async () => {
    const create = jest
      .fn()
      .mockImplementation(({ data }) => ({ id: 'extra', ...data }));
    const service = serviceCon(
      {
        producto: {
          findFirst: jest.fn().mockResolvedValue({ id: 'producto' }),
        },
        familiaPasoDefaults: {
          findUnique: jest.fn().mockResolvedValue({
            configBaseJson: {
              nombreVisible: 'Corte láser configurado',
              modoActivacion: 'OPCIONAL',
              modoTiempo: 'T-3',
              mecanismoCantidad: 'CALCULADO_POR_PASO',
              mecanismoCantidadConfigJson: { magnitud: 'mlCorte' },
              multiplicadoresActivos: ['cantidad'],
              paramsPasoJson: { operacion: 'corte' },
              setupOverrideMin: 4,
              slotsMateriales: [{ slotCodigo: 'sustrato' }],
              maquinasCandidatas: [{ maquinaId: 'maquina-candidata' }],
            },
          }),
        },
        productoPasoExtra: {
          findFirst: jest.fn().mockResolvedValue(null),
          create,
        },
      },
      { assertFamiliaExiste: jest.fn().mockResolvedValue(undefined) },
    );

    await service.agregarPasoExtra('tenant', 'producto', {
      familiaCodigo: 'corte_laser',
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nombreVisible: 'Corte láser configurado',
        modoActivacion: 'OPCIONAL',
        modoTiempo: 'T-3',
        mecanismoCantidad: 'CALCULADO_POR_PASO',
        mecanismoCantidadConfigJson: { magnitud: 'mlCorte' },
        multiplicadoresActivos: ['cantidad'],
        paramsPasoJson: { operacion: 'corte' },
        setupOverrideMin: 4,
        configSlotsMaterialesJson: [{ slotCodigo: 'sustrato' }],
        configMaquinasCandidatasJson: [{ maquinaId: 'maquina-candidata' }],
      }),
    });
  });

  it('materializa la base de un paso propio y respeta overrides del alta', async () => {
    const pasoTenantId = '11111111-1111-4111-8111-111111111111';
    const create = jest
      .fn()
      .mockImplementation(({ data }) => ({ id: 'extra', ...data }));
    const findUniqueSistema = jest.fn();
    const service = serviceCon(
      {
        producto: {
          findFirst: jest.fn().mockResolvedValue({ id: 'producto' }),
        },
        pasoTenant: {
          findFirst: jest.fn().mockResolvedValue({
            configBaseJson: {
              modoActivacion: 'OPCIONAL',
              modoTiempo: 'T-2',
              paramsPasoJson: { horasEstimadas: 2 },
            },
          }),
        },
        familiaPasoDefaults: { findUnique: findUniqueSistema },
        productoPasoExtra: {
          findFirst: jest.fn().mockResolvedValue(null),
          create,
        },
      },
      { assertFamiliaExiste: jest.fn().mockResolvedValue(undefined) },
    );

    await service.agregarPasoExtra('tenant', 'producto', {
      familiaCodigo: pasoTenantId,
      modoActivacion: 'OBLIGATORIO',
      paramsPasoJson: { horasEstimadas: 5 },
    });

    expect(findUniqueSistema).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        modoActivacion: 'OBLIGATORIO',
        modoTiempo: 'T-2',
        paramsPasoJson: { horasEstimadas: 5 },
      }),
    });
  });
});
