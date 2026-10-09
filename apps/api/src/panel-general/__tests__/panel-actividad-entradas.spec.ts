import { BadRequestException } from '@nestjs/common';
import { expandir } from '../../auth/permisos';
import type { CurrentAuth } from '../../auth/auth.types';
import { PanelActividadService } from '../panel-actividad.service';

const auth = {
  tenantId: '11111111-1111-4111-8111-111111111111',
  role: 'ADMINISTRADOR',
  permisos: expandir(['panel.ver', 'comercial.ver', 'reportes.resumen.ver']),
} as CurrentAuth;
const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
const cursor = { fecha: '2026-09-30T10:00:00.000Z', id: 'orden:123' };

describe('Entrada del cursor de actividad', () => {
  it.each([
    ['query repetida', [encode(cursor), encode(cursor)]],
    ['objeto en query', { length: 1, value: encode(cursor) }],
    ['fecha como lista', encode({ ...cursor, fecha: [cursor.fecha] })],
    ['identidad como lista', encode({ ...cursor, id: [cursor.id] })],
    ['cursor demasiado largo', 'a'.repeat(513)],
  ])('rechaza %s antes de consultar', async (_nombre, value) => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    await expect(
      new PanelActividadService(prisma as never).listar(auth, value as string),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('conserva los cursores válidos y la consulta sin cursor', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([]) };
    const service = new PanelActividadService(prisma as never);
    await expect(service.listar(auth, encode(cursor))).resolves.toEqual({
      items: [],
      siguienteCursor: null,
    });
    await expect(service.listar(auth)).resolves.toEqual({
      items: [],
      siguienteCursor: null,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
