import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { ConfigPasosService } from '../config-pasos.service';
import {
  MecanismoCantidadPasoDto,
  ModoActivacionPasoDto,
} from '../dto/producto-ruta.dto';
import type { FamiliasPasosService } from '../familias-pasos.service';

function crearServicio(prisma: Record<string, unknown> = {}) {
  const familias = {
    validarConfigPasoContraFamilia: jest.fn(),
  };
  return {
    service: new ConfigPasosService(
      prisma as unknown as PrismaService,
      familias as unknown as FamiliasPasosService,
    ),
    familias,
  };
}

describe('ConfigPasosService — integridad de reglas y herencia', () => {
  it('rechaza una regla JsonLogic inválida antes de persistir', async () => {
    const { service } = crearServicio();

    await expect(
      service.validarConfiguracionBase('tenant', 'trabajo_manual', {
        modoActivacion: ModoActivacionPasoDto.CONDICIONAL,
        condicionActivacionJson: { operador_inexistente: [1] },
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('una configuración reutilizable no puede apuntar a un paso de una ruta', async () => {
    const { service } = crearServicio();

    await expect(
      service.validarConfiguracionBase('tenant', 'trabajo_manual', {
        mecanismoCantidad: MecanismoCantidadPasoDto.HEREDAR_DEL_OUTPUT_CANONICO,
        mecanismoCantidadConfigJson: {
          origen: {
            rutaPasoId: '11111111-1111-4111-8111-111111111111',
            capacidad: 'unidades_procesadas',
          },
        },
      } as never),
    ).rejects.toThrow('ruta concreta');
  });

  it('rechaza heredar desde un paso que no pertenece a la misma ruta y versión', async () => {
    const rutaPasoFindFirst = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'destino',
        orden: 3,
        familiaCodigo: 'trabajo_manual',
      })
      .mockResolvedValueOnce(null);
    const { service } = crearServicio({
      productoRutaAlternativa: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'alternativa',
          rutaId: 'ruta',
          rutaVersion: 2,
        }),
      },
      rutaPaso: { findFirst: rutaPasoFindFirst },
    });

    await expect(
      service.upsertConfigPaso('tenant', 'alternativa', {
        rutaPasoId: 'destino',
        mecanismoCantidad: MecanismoCantidadPasoDto.HEREDAR_DEL_OUTPUT_CANONICO,
        mecanismoCantidadConfigJson: {
          origen: {
            rutaPasoId: 'origen-de-otra-ruta',
            capacidad: 'unidades_procesadas',
          },
        },
      } as never),
    ).rejects.toThrow('paso activo anterior de la misma ruta y versión');
  });
});
