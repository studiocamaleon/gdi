import { EstadoTarifaCentroCostoPeriodo, Prisma } from '@prisma/client';
import { loadTarifasHorarias } from './load-tarifas';

describe('loadTarifasHorarias', () => {
  const tarifa = (extra: Record<string, unknown>) => ({
    centroCostoId: 'centro-1',
    periodo: '2026-07',
    tarifaCalculada: new Prisma.Decimal(100),
    tarifaManoObra: new Prisma.Decimal(40),
    estado: EstadoTarifaCentroCostoPeriodo.PUBLICADA,
    ...extra,
  });

  it('usa carry-forward cuando el período más reciente está publicado', async () => {
    const prisma = {
      centroCostoTarifaPeriodo: {
        findMany: jest.fn().mockResolvedValue([tarifa({})]),
      },
    };

    const resultado = await loadTarifasHorarias(prisma as any, {
      tenantId: 'tenant-1',
      periodo: '2026-08',
      centroCostoIds: ['centro-1'],
    });

    expect(resultado.get('centro-1')?.tarifa.toNumber()).toBe(100);
    const llamadas = prisma.centroCostoTarifaPeriodo.findMany.mock
      .calls as unknown as Array<
      [{ where?: { centroCosto?: { activo?: boolean } } }]
    >;
    const llamada = llamadas[0]?.[0];
    expect(llamada?.where?.centroCosto).toEqual({ activo: true });
  });

  it('un borrador inválido reciente bloquea el carry-forward anterior', async () => {
    const prisma = {
      centroCostoTarifaPeriodo: {
        findMany: jest.fn().mockResolvedValue([
          tarifa({
            periodo: '2026-08',
            estado: EstadoTarifaCentroCostoPeriodo.BORRADOR,
            tarifaCalculada: new Prisma.Decimal(0),
          }),
          tarifa({ periodo: '2026-07' }),
        ]),
      },
    };

    const resultado = await loadTarifasHorarias(prisma as any, {
      tenantId: 'tenant-1',
      periodo: '2026-08',
      centroCostoIds: ['centro-1'],
    });

    expect(resultado.has('centro-1')).toBe(false);
  });
});
