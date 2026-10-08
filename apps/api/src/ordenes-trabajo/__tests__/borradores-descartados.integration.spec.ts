import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import { OrdenesTrabajoQueryDto } from '../dto/ordenes-trabajo-query.dto';
import type { CurrentAuth } from '../../auth/auth.types';

const db = new PrismaService();
afterAll(() => db.$disconnect());

it('archiva borradores descartados fuera de Todas y sus contadores, sin ocultar órdenes canceladas ni cruzar negocios', async () => {
  const rollback = new Error('rollback prueba descartados');
  await expect(
    db.$transaction(
      async (tx) => {
        const tenantId = randomUUID();
        const otroTenant = randomUUID();
        await tx.tenant.createMany({
          data: [tenantId, otroTenant].map((id) => ({
            id,
            nombre: 'QA archivo',
            slug: `qa-${id}`,
          })),
        });
        await tx.ordenTrabajo.createMany({
          data: [
            { tenantId, numero: 'BORRADOR', estado: 'borrador' },
            {
              tenantId,
              numero: 'DESCARTADO',
              estado: 'cancelada',
              estadoAlCancelar: 'borrador',
            },
            {
              tenantId,
              numero: 'CANCELADA',
              estado: 'cancelada',
              estadoAlCancelar: 'pendiente',
            },
            { tenantId, numero: 'HISTORICA', estado: 'cancelada' },
            { tenantId, numero: 'EMITIDA', estado: 'pendiente' },
            {
              tenantId: otroTenant,
              numero: 'OTRO-DESCARTADO',
              estado: 'cancelada',
              estadoAlCancelar: 'borrador',
            },
          ],
        });
        const prisma = new Proxy(tx, {
          get(target, prop) {
            if (prop === '$transaction')
              return (ops: Promise<unknown>[]) => Promise.all(ops);
            return Reflect.get(target, prop);
          },
        });
        const service = Object.create(
          OrdenesTrabajoService.prototype,
        ) as OrdenesTrabajoService;
        Object.assign(service, { prisma });
        const auth = { tenantId } as CurrentAuth;
        const consultar = (estado?: string, q?: string) =>
          service.findAll(
            auth,
            Object.assign(new OrdenesTrabajoQueryDto(), { estado, q }),
          );
        const todas = await consultar();
        expect(todas.data.map((o) => o.numero).sort()).toEqual([
          'BORRADOR',
          'CANCELADA',
          'EMITIDA',
          'HISTORICA',
        ]);
        expect(todas.total).toBe(4);
        expect(todas.stats.totalOrdenes).toBe(4);
        expect(todas.stats.descartados).toBe(1);
        expect(todas.stats.porEstado).toMatchObject({
          borrador: 1,
          pendiente: 1,
          cancelada: 2,
        });
        expect((await consultar('borrador')).data.map((o) => o.numero)).toEqual(
          ['BORRADOR'],
        );
        expect((await consultar('cancelada')).total).toBe(2);
        expect((await consultar(undefined, 'DESCARTADO')).total).toBe(0);
        const archivo = await consultar('descartada', 'DESCARTADO');
        expect(archivo.total).toBe(1);
        expect(archivo.data[0]).toMatchObject({
          numero: 'DESCARTADO',
          borradorDescartado: true,
        });
        throw rollback;
      },
      { timeout: 20000 },
    ),
  ).rejects.toBe(rollback);
});
