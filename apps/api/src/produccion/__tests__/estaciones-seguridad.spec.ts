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

type ServicePrivado = ProduccionService & {
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
  validarInvariantesRuteo: (tx: unknown, tenantId: string) => Promise<void>;
};

function servicio(prisma: Record<string, unknown>) {
  return new ProduccionService(prisma as never) as ServicePrivado;
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

  it('revalida estaciones que quedan generales después de mover una máquina', async () => {
    const service = servicio({});
    const tx = {
      estacion: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a',
            nombre: 'Impresión A',
            maquinas: [],
            reglas: [{ valor: 'impresion_por_hoja' }],
          },
          {
            id: 'b',
            nombre: 'Impresión B',
            maquinas: [],
            reglas: [{ valor: 'impresion_por_hoja' }],
          },
        ]),
      },
    };
    await expect(
      service.validarInvariantesRuteo(tx, auth.tenantId),
    ).rejects.toBeInstanceOf(ConflictException);
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
