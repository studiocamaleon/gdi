import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import { expandir } from '../../auth/permisos';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { PanelGeneralService } from '../panel-general.service';

describe('Atrasos de producción y órdenes para retirar (PostgreSQL)', () => {
  const db = new PrismaClient();
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    )
      throw new Error('Sólo base local de pruebas.');
  });
  afterAll(() => db.$disconnect());
  afterEach(() => jest.useRealTimers());

  it('sólo atrasa el trabajo sin terminar; lo finalizado espera retiro sin importar la fecha', async () => {
    jest
      .useFakeTimers({
        doNotFake: [
          'nextTick',
          'setImmediate',
          'clearImmediate',
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'performance',
        ],
      })
      .setSystemTime(new Date('2026-10-08T01:30:00Z'));
    const rollback = new Error('Deshacer fixtures de entregas');
    await expect(
      db.$transaction(
        async (tx) => {
          const empresas = await Promise.all(
            [0, 1].map(() =>
              tx.tenant.create({
                data: {
                  slug: `qa-entregas-${randomUUID()}`,
                  nombre: 'Empresa ficticia',
                },
              }),
            ),
          );
          const casos: Array<[string, string, string | null, number?]> = [
            ['pendiente-vencida', 'pendiente', '2026-10-06'],
            ['produccion-vencida', 'produccion', '2026-10-06'],
            ['hoy', 'produccion', '2026-10-07'],
            ['proxima', 'pendiente', '2026-10-08'],
            ['fuera-ventana', 'pendiente', '2026-10-20'],
            ['lista-antigua', 'finalizada', '2026-09-01'],
            ['lista-hoy', 'finalizada', '2026-10-07'],
            ['lista-futura', 'finalizada', '2026-10-20'],
            ['lista-sin-fecha', 'finalizada', null],
            ['entregada', 'entregada', '2026-10-01'],
            ['cancelada', 'cancelada', '2026-10-01'],
            ['borrador', 'borrador', '2026-10-01'],
            ['activa-sin-fecha', 'produccion', null],
            ['ajena-vencida', 'produccion', '2026-10-01', 1],
            ['ajena-lista', 'finalizada', '2026-10-01', 1],
          ];
          for (const [numero, estado, fecha, empresa = 0] of casos) {
            const tenantId = empresas[empresa].id;
            await tx.ordenTrabajo.create({
              data: {
                tenantId,
                numero,
                estado,
                fechaEntrega: fecha ? new Date(`${fecha}T00:00:00Z`) : null,
                items: {
                  create: {
                    tenantId,
                    codigo: numero,
                    nombre: 'Impresión ficticia',
                    familia: 'Prueba',
                    cantidad: 1,
                    cantidadUnidad: 'unidad',
                    subtotal: 100,
                    impuestos: 21,
                    total: 121,
                    entregadoEl: estado === 'entregada' ? new Date() : null,
                  },
                },
              },
            });
          }
          const service = new PanelGeneralService(
            tx as never,
            { tablero: async () => ({ items: [] }) } as never,
            { obtener: jest.fn() } as never,
            capacidadesDePrueba(),
          );
          const auth = {
            tenantId: empresas[0].id,
            userId: randomUUID(),
            role: 'ADMINISTRADOR',
            permisos: expandir([
              'panel.ver',
              'produccion.ver',
              'comercial.ver',
            ]),
          } as CurrentAuth;
          const panel = await service.obtener(auth);
          expect(panel.fechaLocal).toBe('2026-10-07');
          expect(
            panel.entregas?.atrasada.items.map((o) => o.numero).sort(),
          ).toEqual(['pendiente-vencida', 'produccion-vencida']);
          expect(panel.entregas?.atrasada.total).toBe(2);
          expect(panel.kpis.find((k) => k.id === 'atrasadas')?.valor).toBe(2);
          expect(
            panel.atencion.find((a) => a.id === 'ordenes-atrasadas')?.cantidad,
          ).toBe(2);
          expect(panel.entregas?.hoy.items.map((o) => o.numero)).toEqual([
            'hoy',
          ]);
          expect(panel.entregas?.proxima.items.map((o) => o.numero)).toEqual([
            'proxima',
          ]);
          expect(
            panel.entregas?.lista.items.map((o) => o.numero).sort(),
          ).toEqual([
            'lista-antigua',
            'lista-futura',
            'lista-hoy',
            'lista-sin-fecha',
          ]);
          expect(panel.entregas?.lista.total).toBe(4);
          expect(panel.kpis.find((k) => k.id === 'listos-retiro')?.valor).toBe(
            4,
          );
          const sinFecha = panel.entregas?.lista.items.find(
            (o) => o.numero === 'lista-sin-fecha',
          );
          expect(sinFecha?.fechaEntrega).toBeNull();
          expect(sinFecha?.progresoPct).toBeNull(); // Finalizada explícitamente, sin inventar avance.
          // Al entregar una orden sale de la espera, sin generar un atraso.
          await tx.ordenTrabajo.updateMany({
            where: { tenantId: auth.tenantId, numero: 'lista-antigua' },
            data: { estado: 'entregada' },
          });
          const actualizado = await service.obtener(auth);
          expect(actualizado.entregas?.lista.total).toBe(3);
          expect(actualizado.entregas?.atrasada.total).toBe(2);
          throw rollback;
        },
        { timeout: 20000 },
      ),
    ).rejects.toBe(rollback);
  });
});
