import { BadRequestException } from '@nestjs/common';
import type { CurrentAuth } from '../../auth/auth.types';
import { EgresosService } from '../egresos.service';

const auth = {
  tenantId: '11111111-1111-4111-8111-111111111111',
} as CurrentAuth;

describe('Entradas de filtros de egresos', () => {
  const create = () => {
    const prisma = { egreso: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new EgresosService(
      prisma as never,
      null as never,
      null as never,
      null as never,
    );
    return { prisma, service };
  };

  it.each([
    ['fecha repetida', { desde: ['2026-09-01', '2026-09-30'] }],
    ['fecha objeto', { hasta: { value: '2026-09-30' } }],
    ['fecha inexistente', { desde: '2026-02-30' }],
    ['fecha incompleta', { hasta: '2026-09' }],
    ['texto repetido', { texto: ['uno', 'dos'] }],
    ['estado como objeto', { estado: { not: 'anulado' } }],
    ['proveedor como lista', { proveedorId: ['uno', 'dos'] }],
  ])('rechaza %s sin ejecutar la búsqueda', async (_nombre, q) => {
    const { prisma, service } = create();
    await expect(service.listar(auth, q as never)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.egreso.findMany).not.toHaveBeenCalled();
  });

  it.each(['2026-09-30', '2026-09-30T23:30:00-03:00'])(
    'conserva el día calendario de %s',
    async (desde) => {
      const { prisma, service } = create();
      await service.listar(auth, { desde });
      expect(prisma.egreso.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: auth.tenantId,
            fechaCompetencia: { gte: new Date('2026-09-30T00:00:00Z') },
          }) as unknown,
        }),
      );
    },
  );
});
