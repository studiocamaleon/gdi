import { PrismaClient } from '@prisma/client';
import { EntregaService } from '../entrega.service';
import { OrdenesTrabajoService } from '../ordenes-trabajo.service';
import { PanelGeneralService } from '../../panel-general/panel-general.service';
import type { CurrentAuth } from '../../auth/auth.types';

describe('productos comerciales con componentes en entrega y seguimiento (PostgreSQL)', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());

  it('espera a los nietos, proyecta raíces, entrega parcialmente y revierte sin exigir entregas internas', async () => {
    const rollback = new Error('rollback entrega F4');
    await expect(
      db.$transaction(
        async (tx) => {
          const { id: tenantId } = await tx.tenant.findUniqueOrThrow({
            where: { slug: 'gdi-demo' },
          });
          const usuario = await tx.user.findFirstOrThrow();
          const auth = {
            tenantId,
            userId: usuario.id,
            email: usuario.email,
            permisos: new Set([
              'produccion.ver',
              'produccion.gestionar',
              'comercial.ver',
            ]),
          } as CurrentAuth;
          const orden = await tx.ordenTrabajo.create({
            data: {
              tenantId,
              numero: 'PRUEBA-F4-ENTREGA',
              estado: 'produccion',
              fechaEntrega: new Date('2098-12-01'),
              total: 100,
            },
          });
          const crear = (nombre: string, parentItemId?: string) =>
            tx.ordenTrabajoItem.create({
              data: {
                tenantId,
                ordenId: orden.id,
                codigo: nombre,
                nombre,
                familia: 'Prueba',
                cantidad: 1,
                cantidadUnidad: 'unidad',
                subtotal: parentItemId ? 0 : 100,
                impuestos: 0,
                total: parentItemId ? 0 : 100,
                parentItemId,
              },
            });
          const kit = await crear('Kit');
          const simple = await crear('Simple sin fabricación');
          const hijo = await crear('Interno', kit.id);
          const nieto = await crear('Corte nieto', hijo.id);
          const alias = await crear('Participación', kit.id);
          const crearPaso = (
            itemId: string,
            nombre: string,
            estado: string,
            nestingLoteRol?: string,
          ) =>
            tx.ordenTrabajoItemPaso.create({
              data: {
                tenantId,
                ordenId: orden.id,
                itemId,
                indice: 0,
                nombre,
                familiaCodigo: 'trabajo_manual',
                categoriaFamilia: 'produccion',
                estado,
                nestingLoteRol,
                completadoEl: estado === 'hecho' ? new Date() : null,
              },
            });
          await crearPaso(hijo.id, 'Impresión', 'hecho', 'OPERATIVO');
          await crearPaso(
            alias.id,
            'Participación impresión',
            'hecho',
            'PARTICIPANTE',
          );
          const corte = await crearPaso(nieto.id, 'Corte', 'pendiente');
          const prisma = new Proxy(tx, {
            get(target, prop) {
              return prop === '$transaction'
                ? (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)
                : Reflect.get(target, prop);
            },
          });
          const servicio = new EntregaService(
            prisma as never,
            { create: jest.fn() } as never,
            { reconciliarOrden: jest.fn() } as never,
          );
          const escaneo = await servicio.escanear(auth, orden.numero!);
          expect(escaneo.items).toHaveLength(2);
          expect(escaneo.items.find((i) => i.id === kit.id)).toMatchObject({
            listo: false,
            pasosTotal: 2,
            pasosHechos: 1,
            pasoActual: 'Corte',
          });
          expect(escaneo.items.find((i) => i.id === simple.id)?.listo).toBe(
            true,
          );
          await expect(
            servicio.entregar(auth, orden.id, { itemIds: [kit.id] }),
          ).rejects.toThrow('todavía está en producción');
          await expect(
            servicio.entregar(auth, orden.id, { itemIds: [hijo.id] }),
          ).rejects.toThrow('no pertenece');

          const ot = Object.create(
            OrdenesTrabajoService.prototype,
          ) as OrdenesTrabajoService;
          Object.assign(ot, {
            prisma: tx,
            enlaces: { resolver: async () => ({ entidadId: orden.id }) },
            empresa: { paraDocumentos: async () => ({}) },
          });
          const tracking = await ot.trackingPublico('token-test');
          expect(tracking.items).toHaveLength(2);
          expect(tracking.items.find((i) => i.id === kit.id)).toMatchObject({
            progresoPct: 50,
            pasoActual: 'Corte',
          });
          expect(tracking.progresoPct).toBe(50);
          expect(tracking.actividad).toHaveLength(1);
          expect(JSON.stringify(tracking)).not.toContain(
            'Participación impresión',
          );
          expect(JSON.stringify(tracking)).not.toContain('subtotal');
          const panel = new PanelGeneralService(
            tx as never,
            {} as never,
          ) as any;
          const entregas = await panel.ordenesProximas(
            tenantId,
            '2098-12-01',
            '2098-12-01',
            {},
          );
          const proxima = entregas.find((e: any) => e.id === orden.id);
          expect(proxima.producto).toBe('2 productos');
          expect(proxima.productos).toHaveLength(2);
          expect(
            proxima.productos.find((p: any) => p.id === kit.id).progresoPct,
          ).toBe(50);

          expect(
            await servicio.entregar(auth, orden.id, { itemIds: [simple.id] }),
          ).toMatchObject({ entregados: 1, ordenCerrada: false });
          await tx.ordenTrabajoItemPaso.update({
            where: { id: corte.id },
            data: { estado: 'hecho' },
          });
          expect(
            await servicio.entregar(auth, orden.id, { itemIds: [kit.id] }),
          ).toMatchObject({ entregados: 1, ordenCerrada: true });
          expect(
            await tx.ordenTrabajoItem.count({
              where: {
                ordenId: orden.id,
                parentItemId: { not: null },
                entregadoEl: null,
              },
            }),
          ).toBe(3);
          expect(
            (
              await tx.ordenTrabajo.findUniqueOrThrow({
                where: { id: orden.id },
              })
            ).estado,
          ).toBe('entregada');
          expect(
            await servicio.revertir(auth, orden.id, {
              itemIds: [kit.id],
              motivo: 'Prueba de reversión',
            }),
          ).toEqual({ revertidos: 1 });
          expect(
            (
              await tx.ordenTrabajo.findUniqueOrThrow({
                where: { id: orden.id },
              })
            ).estado,
          ).toBe('finalizada');
          expect(
            (await servicio.escanear(auth, orden.numero!)).items.find(
              (i) => i.id === kit.id,
            )?.entregadoEl,
          ).toBeNull();
          await expect(
            servicio.escanear(
              { ...auth, tenantId: '11111111-1111-4111-8111-111111111111' },
              orden.numero!,
            ),
          ).rejects.toThrow('No encontramos');
          throw rollback;
        },
        { timeout: 25_000 },
      ),
    ).rejects.toBe(rollback);
    expect(
      await db.ordenTrabajo.count({ where: { numero: 'PRUEBA-F4-ENTREGA' } }),
    ).toBe(0);
  });
});
