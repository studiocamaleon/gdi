import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { CurrentAuth } from '../../auth/auth.types';
import { expandir } from '../../auth/permisos';
import { capacidadesDePrueba } from '../../../test/fixture-capacidades';
import { PanelGeneralService } from '../panel-general.service';
import {
  filtroOrdenesEntregas,
  seleccionEntregasProduccion,
} from '../../common/entregas-produccion';
import { entregasParaPantalla } from '../../pantallas-produccion/entregas-pantalla';

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
          expect(panel.kpis.find((k) => k.id === 'entregas-hoy')?.valor).toBe(
            panel.entregas?.hoy.total,
          );
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

          // OT mixta fuera de la ventana: mandan las fechas y el trabajo de
          // cada producto. Un componente pendiente impide darlo por terminado.
          const tenantId = auth.tenantId;
          const mixta = await tx.ordenTrabajo.create({
            data: {
              tenantId,
              numero: 'mixta',
              estado: 'produccion',
              fechaEntrega: new Date('2026-10-20'),
            },
          });
          const item = async (
            nombre: string,
            fecha: string | null,
            extras: {
              parentItemId?: string;
              listoEnMostrador?: boolean;
              entregadoEl?: Date;
            } = {},
          ) =>
            tx.ordenTrabajoItem.create({
              data: {
                tenantId,
                ordenId: mixta.id,
                codigo: nombre,
                nombre,
                familia: 'Prueba',
                cantidad: 1,
                cantidadUnidad: 'un',
                subtotal: 0,
                impuestos: 0,
                total: 0,
                fechaEntrega: fecha ? new Date(fecha) : null,
                ...extras,
              },
            });
          const atrasado = await item('Pendiente vencido', '2026-10-06');
          const hoyItem = await item('Pendiente hoy', '2026-10-07');
          const padre = await item(
            'Producto con componente pendiente',
            '2026-10-05',
          );
          const hijo = await item('Componente', null, {
            parentItemId: padre.id,
          });
          const completo = await item('Terminado por pasos', '2026-10-06');
          const mostrador = await item('Terminado en mostrador', '2026-10-07', {
            listoEnMostrador: true,
          });
          await item('Entregado parcialmente', '2026-10-06', {
            entregadoEl: new Date(),
          });
          await item('Futuro propio', '2026-10-30');
          await item('Hereda fecha futura', null);
          for (const [itemId, estado] of [
            [padre.id, 'hecho'],
            [hijo.id, 'pendiente'],
            [completo.id, 'hecho'],
          ]) {
            await tx.ordenTrabajoItemPaso.create({
              data: {
                tenantId,
                ordenId: mixta.id,
                itemId,
                estado,
                indice: 0,
                nombre: 'Operación ficticia',
                familiaCodigo: 'prueba',
                categoriaFamilia: 'prueba',
              },
            });
          }
          const comparar = async () => {
            const panel = await service.obtener(auth);
            const tv = entregasParaPantalla(
              await tx.ordenTrabajo.findMany({
                where: filtroOrdenesEntregas(tenantId, {}, panel.fechaLocal),
                select: seleccionEntregasProduccion,
              }),
              panel.fechaLocal,
            );
            for (const [grupo, kpi, claveTV] of [
              ['atrasada', 'atrasadas', 'atrasadas'],
              ['hoy', 'entregas-hoy', 'hoy'],
            ] as const) {
              expect(panel.kpis.find((k) => k.id === kpi)?.valor).toBe(
                panel.entregas![grupo].total,
              );
              expect(tv.resumen[claveTV]).toBe(panel.entregas![grupo].total);
              expect(
                tv.filas
                  .filter((f) => f.atrasada === (grupo === 'atrasada'))
                  .map((f) => f.id),
              ).toEqual(panel.entregas![grupo].items.map((f) => f.id));
            }
            expect(
              panel.kpis.find((k) => k.id === 'listos-retiro')?.valor,
            ).toBe(panel.entregas!.lista.total);
            expect(tv.filas.every((f) => f.estado !== 'lista')).toBe(true);
            for (const fila of tv.filas) {
              const entrega = [
                ...panel.entregas!.atrasada.items,
                ...panel.entregas!.hoy.items,
              ].find((e) => e.id === fila.id)!;
              expect(fila.progresoPct).toBe(entrega.progresoPct);
            }
            return { panel, tv };
          };
          const mixto = await comparar();
          expect(mixto.tv.resumen).toEqual({ atrasadas: 4, hoy: 2 });
          expect(
            mixto.tv.filas.filter((f) => f.orden === 'mixta').map((f) => f.id),
          ).toEqual([padre.id, atrasado.id, hoyItem.id]);
          expect(mixto.panel.entregas!.lista.items.map((f) => f.id)).toEqual(
            expect.arrayContaining([completo.id, mostrador.id]),
          );
          // Reprogramar mueve la misma entrega en ambos lugares.
          await tx.ordenTrabajoItem.update({
            where: { id: atrasado.id },
            data: { fechaEntrega: new Date('2026-10-07') },
          });
          expect((await comparar()).tv.resumen).toEqual({
            atrasadas: 3,
            hoy: 3,
          });
          // Completar el componente saca el producto de ambos pendientes.
          await tx.ordenTrabajoItemPaso.updateMany({
            where: { itemId: hijo.id },
            data: { estado: 'hecho' },
          });
          expect((await comparar()).tv.resumen).toEqual({
            atrasadas: 2,
            hoy: 3,
          });
          // Reabrirlo lo devuelve a la misma prioridad en los dos.
          await tx.ordenTrabajoItemPaso.updateMany({
            where: { itemId: hijo.id },
            data: { estado: 'pendiente' },
          });
          expect((await comparar()).tv.resumen).toEqual({
            atrasadas: 3,
            hoy: 3,
          });
          throw rollback;
        },
        { timeout: 20000 },
      ),
    ).rejects.toBe(rollback);
  });
});
