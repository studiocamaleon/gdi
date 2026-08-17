import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { ConfigPasosService } from '../config-pasos.service';
import { FamiliasPasosService } from '../familias-pasos.service';
import { PasosTenantService } from '../pasos-tenant.service';
import { FAMILIAS } from '../pasos/familias';
import { proyectarPasoTenant } from '../pasos/paso-tenant';

const FILA = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: 'tenant-a',
  plantillaCodigo: 'trabajo_manual',
  nombre: 'Bordado',
  descripcion: null,
  icono: null,
  activo: true,
  centroCostoId: null,
  productividadHora: null,
  tiempoFijoMin: null,
  demasiaMm: null,
  solapePanelMm: null,
  tercerizado: null,
  proveedorId: null,
  fuenteCostoTercerizado: null,
  plazoProveedorDias: null,
  configBaseJson: null,
};

describe('PasosTenantService', () => {
  it('preserva defaults omitidos en una actualización parcial', async () => {
    const update = jest.fn().mockResolvedValue({
      ...FILA,
      productividadHora: 25,
    });
    const prisma = {
      pasoTenant: {
        findFirst: jest.fn().mockResolvedValue(FILA),
        update,
      },
    } as unknown as PrismaService;
    const config = {} as ConfigPasosService;

    await new PasosTenantService(prisma, config).actualizar(
      FILA.tenantId,
      FILA.id,
      { defaults: { productividadHora: 25 } },
    );

    const data = update.mock.calls[0][0].data;
    expect(data.productividadHora).toBe(25);
    expect(data).not.toHaveProperty('centroCostoId');
    expect(data).not.toHaveProperty('proveedorId');
    expect(data).not.toHaveProperty('tiempoFijoMin');
  });

  it('guarda la configuración aparte de la definición heredada', async () => {
    const validarConfiguracionBase = jest.fn().mockResolvedValue(undefined);
    const update = jest
      .fn()
      .mockImplementation(({ data }) =>
        Promise.resolve({ ...FILA, configBaseJson: data.configBaseJson }),
      );
    const prisma = {
      pasoTenant: {
        findFirst: jest.fn().mockResolvedValue(FILA),
        update,
      },
      rutaPaso: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const config = {
      validarConfiguracionBase,
    } as unknown as ConfigPasosService;
    const payload = {
      rutaPasoId: FILA.id,
      modoActivacion: 'OBLIGATORIO' as const,
      modoTiempo: 'T-2' as const,
      mecanismoCantidad: 'CALCULADO_POR_PASO' as const,
      paramsPasoJson: { productivityValue: 20 },
    };

    const resultado = await new PasosTenantService(
      prisma,
      config,
    ).actualizarConfiguracionBase(FILA.tenantId, FILA.id, payload);

    expect(validarConfiguracionBase).toHaveBeenCalledWith(
      FILA.tenantId,
      FILA.plantillaCodigo,
      payload,
    );
    expect(resultado.configBase).toEqual({
      modoActivacion: 'OBLIGATORIO',
      modoTiempo: 'T-2',
      mecanismoCantidad: 'CALCULADO_POR_PASO',
      paramsPasoJson: { productivityValue: 20 },
    });
    expect(proyectarPasoTenant(FILA)?.codigo).toBe(FILA.id);
    expect(proyectarPasoTenant(FILA)?.plantillaCodigo).toBe(
      FILA.plantillaCodigo,
    );
    expect(proyectarPasoTenant(FILA)?.modosTiempoSoportados).toBe(
      FAMILIAS.trabajo_manual.modosTiempoSoportados,
    );
  });

  it('materializa la base sólo en rutas que todavía no tienen configuración propia', async () => {
    const upsertConfigPaso = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      pasoTenant: {
        findFirst: jest.fn().mockResolvedValue(FILA),
        update: jest
          .fn()
          .mockResolvedValue({
            ...FILA,
            configBaseJson: { modoTiempo: 'T-2' },
          }),
      },
      rutaPaso: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'paso-a', rutaId: 'ruta-1', version: 2 },
          { id: 'paso-b', rutaId: 'ruta-2', version: 1 },
        ]),
      },
      productoRutaAlternativa: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'alternativa-a',
            rutaId: 'ruta-1',
            rutaVersion: 2,
            configPasos: [],
          },
          {
            id: 'alternativa-b',
            rutaId: 'ruta-2',
            rutaVersion: 1,
            configPasos: [{ rutaPasoId: 'paso-b' }],
          },
        ]),
      },
    } as unknown as PrismaService;
    const config = {
      validarConfiguracionBase: jest.fn().mockResolvedValue(undefined),
      upsertConfigPaso,
    } as unknown as ConfigPasosService;

    await new PasosTenantService(prisma, config).actualizarConfiguracionBase(
      FILA.tenantId,
      FILA.id,
      {
        rutaPasoId: FILA.id,
        modoTiempo: 'T-2',
      },
    );

    expect(upsertConfigPaso).toHaveBeenCalledTimes(1);
    expect(upsertConfigPaso).toHaveBeenCalledWith(
      FILA.tenantId,
      'alternativa-a',
      expect.objectContaining({
        rutaPasoId: 'paso-a',
        modoTiempo: 'T-2',
        requiereRutaPasoIds: [],
      }),
    );
  });

  it('configura una familia de Grafo sin crear una copia del paso', async () => {
    const upsert = jest.fn().mockResolvedValue({
      familiaCodigo: 'trabajo_manual',
      configBaseJson: { modoTiempo: 'T-2' },
    });
    const prisma = {
      familiaPasoDefaults: { upsert },
      rutaPaso: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'ruta-paso-sistema', rutaId: 'ruta-sistema', version: 1 },
        ]),
      },
      productoRutaAlternativa: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'alternativa-sistema',
            rutaId: 'ruta-sistema',
            rutaVersion: 1,
            configPasos: [],
          },
        ]),
      },
    } as unknown as PrismaService;
    const validarConfiguracionBase = jest.fn().mockResolvedValue(undefined);
    const upsertConfigPaso = jest.fn().mockResolvedValue(undefined);
    const config = {
      validarConfiguracionBase,
      upsertConfigPaso,
    } as unknown as ConfigPasosService;
    const payload = {
      rutaPasoId: 'trabajo_manual',
      modoTiempo: 'T-2' as const,
    };

    const resultado = await new PasosTenantService(
      prisma,
      config,
    ).actualizarConfiguracionBaseSistema(
      FILA.tenantId,
      'trabajo_manual',
      payload,
    );

    expect(validarConfiguracionBase).toHaveBeenCalledWith(
      FILA.tenantId,
      'trabajo_manual',
      payload,
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId_familiaCodigo: {
            tenantId: FILA.tenantId,
            familiaCodigo: 'trabajo_manual',
          },
        },
      }),
    );
    expect(resultado.configBase).toEqual({ modoTiempo: 'T-2' });
    expect(upsertConfigPaso).toHaveBeenCalledWith(
      FILA.tenantId,
      'alternativa-sistema',
      expect.objectContaining({
        rutaPasoId: 'ruta-paso-sistema',
        modoTiempo: 'T-2',
      }),
    );
    expect(proyectarPasoTenant(FILA)?.codigo).toBe(FILA.id);
  });

  it('impide cambiar la plantilla si el paso ya pertenece a una ruta', async () => {
    const prisma = {
      pasoTenant: {
        findFirst: jest.fn().mockResolvedValue(FILA),
      },
      rutaPaso: { count: jest.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;

    await expect(
      new PasosTenantService(prisma, {} as ConfigPasosService).actualizar(
        FILA.tenantId,
        FILA.id,
        {
        plantillaCodigo: 'impresion_por_hoja',
        },
      ),
    ).rejects.toThrow('No se puede cambiar la plantilla');
  });
});

describe('aislamiento de familias tenant', () => {
  it('rechaza en una ruta un UUID que no pertenece al tenant', async () => {
    const prisma = {
      pasoTenant: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new FamiliasPasosService(prisma);

    await expect(
      service.validarFamiliasDePasos('tenant-a', [
        { familiaCodigo: FILA.id, orden: 1 },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta la misma instancia cuando pertenece al tenant', async () => {
    const prisma = {
      pasoTenant: {
        findMany: jest.fn().mockResolvedValue([{ id: FILA.id }]),
      },
    } as unknown as PrismaService;
    const service = new FamiliasPasosService(prisma);

    await expect(
      service.validarFamiliasDePasos('tenant-a', [
        { familiaCodigo: FILA.id, orden: 1 },
      ]),
    ).resolves.toBeUndefined();
  });
});
