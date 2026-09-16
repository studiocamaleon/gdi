import { BadRequestException, ConflictException } from '@nestjs/common';

import type { CurrentAuth } from '../../auth/auth.types';
import { PERMISO_KEY } from '../../auth/permiso.decorator';
import { ProduccionController } from '../produccion.controller';
import { ProduccionService } from '../produccion.service';
import { resolverEstacionDePaso } from '../../eta/motor/tablero-tipos';

const auth = {
  tenantId: 'tenant-1',
  userId: 'usuario-1',
  permisos: new Set(['produccion.configurar']),
} as CurrentAuth;

type ServicePrivado = {
  validarReferencias: (
    authActual: CurrentAuth,
    payload: {
      nombre: string;
      activo: boolean;
      familias?: string[];
      empleadoIds?: string[];
      maquinaIds?: string[];
      reglas?: Array<{ tipo: 'tecnologia' | 'paso'; valor: string }>;
    },
  ) => Promise<unknown>;
  validarInvariantesRuteo: (tx: unknown, tenantId: string, familias: string[]) => Promise<void>;
};

function servicio(prisma: Record<string, unknown>) {
  return new ProduccionService(prisma as never) as unknown as ServicePrivado;
}

describe('Estaciones — permisos y aislamiento', () => {
  it('reserva toda mutación para produccion.configurar', () => {
    for (const metodo of [
      'createEstacion',
      'updateEstacion',
      'toggleEstacion',
      'deleteEstacion',
      'actualizarConfiguracion',
      'crearDiaNoLaborable',
      'eliminarDiaNoLaborable',
    ] as const) {
      expect(
        Reflect.getMetadata(
          PERMISO_KEY,
          ProduccionController.prototype[metodo],
        ),
      ).toEqual(['produccion.configurar']);
    }
  });

  it('rechaza un paso propio que no pertenece al tenant', async () => {
    const idAjeno = '11111111-1111-4111-8111-111111111111';
    const service = servicio({
      pasoTenant: { findMany: jest.fn().mockResolvedValue([]) },
    });
    await expect(
      service.validarReferencias(auth, {
        nombre: 'Taller',
        activo: true,
        familias: [idAjeno],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza tecnologías inventadas', async () => {
    const service = servicio({
      pasoTenant: { findMany: jest.fn().mockResolvedValue([]) },
    });
    await expect(
      service.validarReferencias(auth, {
        nombre: 'Taller',
        activo: true,
        reglas: [{ tipo: 'tecnologia', valor: 'teletransportacion' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza configurar pasos que exigen máquina como manuales', async () => {
    await expect(servicio({}).validarReferencias(auth, {
      nombre: 'Laser', activo: true, familias: ['corte_laser'],
    })).rejects.toThrow('requiere máquina');
  });

  it('no permite repetir un paso manual aunque la estación tenga máquinas', async () => {
    const service = servicio({ estacionRegla: { findMany: jest.fn().mockResolvedValue([
      { valor: 'embalaje', estacion: { nombre: 'Taller A' } },
    ]) } });
    await expect(service.validarReferencias(auth, {
      nombre: 'Taller B', activo: true, familias: ['embalaje'], maquinaIds: ['maquina-b'],
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('normaliza las reglas manuales anteriores al guardar', async () => {
    const service = servicio({ estacionRegla: { findMany: jest.fn().mockResolvedValue([]) } });
    await expect(service.validarReferencias(auth, {
      nombre: 'Taller', activo: true, familias: ['embalaje'], reglas: [{ tipo: 'paso', valor: 'embalaje' }],
    })).resolves.toMatchObject({ familias: ['embalaje'], reglas: [] });
  });

  it('revalida duplicados dentro de la transacción', async () => {
    const tx = { estacionRegla: { findMany: jest.fn().mockResolvedValue([
      { estacionId: 'a', valor: 'embalaje', estacion: { nombre: 'A' } },
      { estacionId: 'b', valor: 'embalaje', estacion: { nombre: 'B' } },
    ]) } };
    await expect(servicio({}).validarInvariantesRuteo(tx, auth.tenantId, ['embalaje'])).rejects.toBeInstanceOf(ConflictException);
  });

  it('ETA hereda la estación de la plantilla de un paso propio', () => {
    const estacion = {
      id: 'preprensa',
      activo: true,
      familias: ['pre_prensa'],
      maquinas: [],
      reglas: [],
    };
    expect(
      resolverEstacionDePaso([estacion], {
        familiaCodigo: 'paso-tenant-uuid',
        plantillaCodigo: 'pre_prensa',
        centroCostoId: null,
        maquinaId: null,
        tecnologia: null,
      })?.id,
    ).toBe('preprensa');
  });
});
