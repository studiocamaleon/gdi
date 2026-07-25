import { ForbiddenException } from '@nestjs/common';

import { ArchivosService } from '../archivos.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { StorageDriver } from '../storage/storage.driver';
import type { SuscripcionesService } from '../../suscripciones/suscripciones.service';

/**
 * De dónde sale el tope de espacio.
 *
 * Antes de esto el `storageGb` del plan era decorativo: el guard salía temprano
 * cuando `Tenant.cuotaBytesArchivos` era null, así que un tenant sin ajuste
 * manual no tenía tope alguno aunque su plan vendiera 5 GB — y la pantalla
 * decía "sin límite configurado" mientras la suscripción mostraba el número.
 */

const GB = 1024 ** 3;

type Opciones = {
  /** Ajuste del control plane para este tenant. */
  ajusteBytes?: number | null;
  /** Lo que declara el plan. */
  storageGb?: number | null;
  planNombre?: string | null;
  /** Lo que ya ocupa. */
  usadoBytes?: number;
};

function armar({
  ajusteBytes = null,
  storageGb = null,
  planNombre = 'Diamante',
  usadoBytes = 0,
}: Opciones = {}) {
  const prisma = {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        bytesArchivos: BigInt(usadoBytes),
        cuotaBytesArchivos: ajusteBytes === null ? null : BigInt(ajusteBytes),
      }),
    },
    archivo: {
      groupBy: jest.fn().mockResolvedValue([]),
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { bytes: null }, _count: { _all: 0 } }),
    },
  } as unknown as PrismaService;

  const suscripciones = {
    limites: jest.fn().mockResolvedValue({
      planNombre,
      usuariosMax: null,
      ordenesMesMax: null,
      storageGb,
    }),
  } as unknown as SuscripcionesService;

  const service = new ArchivosService(
    prisma,
    {} as StorageDriver,
    suscripciones,
  );
  // `verificarCuota` es privado: es un guard interno, no una operación pública.
  const verificar = (bytes: number) =>
    (
      service as unknown as {
        verificarCuota(tenantId: string, bytes: number): Promise<void>;
      }
    ).verificarCuota('t1', bytes);

  return { service, verificar };
}

describe('cuota de almacenamiento', () => {
  describe('de dónde sale el tope', () => {
    it('sin ajuste, manda el plan', async () => {
      const { service } = armar({ storageGb: 5, usadoBytes: 2 * GB });
      const uso = await service.uso('t1');

      expect(uso.cuotaBytes).toBe(5 * GB);
      expect(uso.cuotaOrigen).toBe('plan');
      expect(uso.restanteBytes).toBe(3 * GB);
      expect(uso.porcentaje).toBe(40);
      expect(uso.plan).toEqual({ nombre: 'Diamante', storageGb: 5 });
    });

    /** El ajuste es una decisión explícita del control plane: pisa al plan. */
    it('el ajuste del tenant le gana al plan', async () => {
      const { service } = armar({ ajusteBytes: 20 * GB, storageGb: 5 });
      const uso = await service.uso('t1');

      expect(uso.cuotaBytes).toBe(20 * GB);
      expect(uso.cuotaOrigen).toBe('ajuste');
      // El plan se sigue informando aunque no sea el que rige.
      expect(uso.plan).toEqual({ nombre: 'Diamante', storageGb: 5 });
    });

    it('sin ajuste y sin plan que lo declare, no hay tope', async () => {
      const { service } = armar({ usadoBytes: 900 * GB });
      const uso = await service.uso('t1');

      expect(uso.cuotaBytes).toBeNull();
      expect(uso.cuotaOrigen).toBe('sin_limite');
      expect(uso.restanteBytes).toBeNull();
      expect(uso.porcentaje).toBeNull();
    });

    /** Bajar el ajuste después de subidas ya hechas deja el uso por encima. */
    it('pasado de cuota, el restante es cero y no un negativo', async () => {
      const { service } = armar({ storageGb: 1, usadoBytes: 3 * GB });
      const uso = await service.uso('t1');

      expect(uso.restanteBytes).toBe(0);
      expect(uso.porcentaje).toBe(100);
    });
  });

  describe('el guard de subida usa el mismo tope', () => {
    it('rechaza la subida que se pasa del plan', async () => {
      const { verificar } = armar({ storageGb: 5, usadoBytes: 4 * GB });

      await expect(verificar(2 * GB)).rejects.toBeInstanceOf(ForbiddenException);
      // El texto tiene que ofrecer la salida correcta: acá frena el plan.
      await expect(verificar(2 * GB)).rejects.toThrow(/plan con más espacio/);
    });

    it('deja pasar la que entra', async () => {
      const { verificar } = armar({ storageGb: 5, usadoBytes: 4 * GB });
      await expect(verificar(GB / 2)).resolves.toBeUndefined();
    });

    /** Si frena un ajuste puesto a mano, cambiar de plan no lo resuelve. */
    it('con ajuste, no manda a cambiar de plan', async () => {
      const { verificar } = armar({ ajusteBytes: GB, usadoBytes: GB });
      await expect(verificar(1)).rejects.toThrow(/te amplíen el espacio/);
    });

    it('sin tope, no frena nada', async () => {
      const { verificar } = armar({ usadoBytes: 900 * GB });
      await expect(verificar(500 * GB)).resolves.toBeUndefined();
    });
  });
});
