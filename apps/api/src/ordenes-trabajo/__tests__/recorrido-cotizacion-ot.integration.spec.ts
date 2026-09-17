import { declararUnidadPrecioFixture } from '../../../test/fixture-unidad-precio';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { MotorUniversalService } from '../../motor-universal/motor.service';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import {
  ejecutarOrdenF4,
  serviciosRecorridoF4,
} from '../../../test/soporte-recorridos-f4';
import type { CurrentAuth } from '../../auth/auth.types';

describe('cotización → emisión → ejecución completa (PostgreSQL)', () => {
  const db = new PrismaClient();
  afterAll(() => db.$disconnect());
  it('conserva la venta simple histórica, controla la secuencia y cierra una OT real con ETA y tracking', async () => {
    const rollback = new Error('rollback recorrido F4');
    let ordenId: string | undefined;
    await expect(
      db.$transaction(
        async (tx) => {
          const tenant = await tx.tenant.findUniqueOrThrow({
            where: { slug: 'gdi-demo' },
          });
          // La transacción revierte también la unidad declarada del seed histórico.
          await declararUnidadPrecioFixture(tx, tenant.id);
          const user = await tx.user.findFirstOrThrow();
          const cliente = await tx.cliente.create({
            data: {
              tenantId: tenant.id,
              nombre: 'Prueba de recorrido F4',
              telefonoCodigo: '54',
              telefonoNumero: '2902000000',
              paisCodigo: 'AR',
            },
          });
          const auth = {
            tenantId: tenant.id,
            userId: user.id,
            email: user.email,
            permisos: new Set([
              'produccion.supervisar',
              'finanzas.ver_margenes',
            ]),
          } as CurrentAuth;
          const producto = await tx.producto.findFirstOrThrow({
            where: { tenantId: tenant.id, codigo: 'TARJ-PREMIUM-300' },
          });
          const { ordenes, prisma } = serviciosRecorridoF4(tx);
          const motor = new MotorUniversalService(
            prisma as never,
            new AplicarPrecioService(),
            new PreciosEspecialesClientesService(prisma as never),
          );
          const guardada = await motor.cotizarYGuardar({
            tenantId: tenant.id,
            productoId: producto.id,
            periodo: '2026-06',
            jobContext: { cantidad: 500, caras: 2 },
          });
          expect(guardada.result.errores).toEqual([]);
          expect(guardada.cotizacionItemId).toBeDefined();
          const snapshot = await tx.cotizacionItem.findUniqueOrThrow({
            where: { id: guardada.cotizacionItemId! },
          });
          const payload = {
            idempotencyKey: randomUUID(),
            estado: 'pendiente' as const,
            clienteId: cliente.id,
            cotizacionId: guardada.cotizacionId!,
            fechaEntrega: '2099-12-01',
            items: [
              {
                cotizacionItemId: snapshot.id,
                codigo: producto.codigo,
                nombre: producto.nombre,
                familia: 'Tarjetas',
                cantidad: 999,
                cantidadUnidad: 'unidad',
                subtotal: 1,
                impuestos: 1,
                total: 2,
              },
            ],
          };
          const emitida = await ordenes.create(auth, payload);
          ordenId = emitida.id;
          expect((await ordenes.create(auth, payload)).id).toBe(ordenId);
          const raiz = await tx.ordenTrabajoItem.findFirstOrThrow({
            where: { ordenId },
          });
          expect(Number(raiz.cantidad)).toBe(500);
          expect(Number(raiz.total)).toBe(Number(snapshot.precioTotal));
          const pasos = await tx.ordenTrabajoItemPaso.findMany({
            where: { ordenId },
            orderBy: { indice: 'asc' },
          });
          expect(pasos.length).toBeGreaterThan(1);
          await expect(
            ordenes.accionPaso(auth, ordenId, raiz.id, pasos.at(-1)!.id, {
              accion: 'completar',
            }),
          ).rejects.toThrow(/dependencias/);
          await expect(
            ordenes.accionPaso(
              { ...auth, tenantId: randomUUID() },
              ordenId,
              raiz.id,
              pasos[0].id,
              { accion: 'completar' },
            ),
          ).rejects.toThrow(/No se encontró/);
          await expect(
            ordenes.accionPaso(
              { ...auth, permisos: new Set() },
              ordenId,
              raiz.id,
              pasos[0].id,
              { accion: 'completar' },
            ),
          ).rejects.toThrow();
          const { orden, ejecutados } = await ejecutarOrdenF4(
            tx,
            ordenes,
            auth,
            ordenId,
          );
          expect(ejecutados).toBe(pasos.length);
          expect(Number(orden.total)).toBe(Number(snapshot.precioTotal));
          expect(
            await tx.ordenTrabajoEvento.count({
              where: { ordenId, tipo: 'paso' },
            }),
          ).toBeGreaterThan(0);
          const tracking = await ordenes.trackingPublico(orden.publicToken!);
          expect(tracking).toMatchObject({
            estado: 'finalizada',
            progresoPct: 100,
          });
          expect(tracking!.items).toHaveLength(1);
          expect(
            (
              await tx.cotizacionItem.findUniqueOrThrow({
                where: { id: snapshot.id },
              })
            ).trazabilidadJson,
          ).toEqual(snapshot.trazabilidadJson);
          throw rollback;
        },
        { timeout: 45000 },
      ),
    ).rejects.toBe(rollback);
    expect(ordenId).toBeDefined();
    expect(await db.ordenTrabajo.count({ where: { id: ordenId } })).toBe(0);
  });
});
