import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { EntregaService } from '../entrega.service';
import type { CurrentAuth } from '../../auth/auth.types';

describe('Entrega inmediata con cobros reales en PostgreSQL', () => {
  const db = new PrismaClient();
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      !url.pathname.endsWith('_test')
    ) {
      throw new Error('Sólo base local de pruebas.');
    }
  });
  afterAll(() => db.$disconnect());

  it('ignora anulados, no duplica aplicaciones y entrega recién al cubrir el total', async () => {
    const rollback = new Error('Deshacer fixtures ficticios');
    await expect(
      db.$transaction(
        async (tx) => {
          const empresa = await tx.tenant.create({
            data: {
              slug: `qa-cierre-${randomUUID()}`,
              nombre: 'Empresa ficticia',
            },
          });
          const tenantId = empresa.id;
          const orden = await tx.ordenTrabajo.create({
            data: {
              tenantId,
              numero: 'OT-FICTICIA',
              estado: 'finalizada',
              total: 100,
              cobradoTotal: 999,
              items: {
                create: {
                  tenantId,
                  codigo: 'SYS-IMPRESION-DOC',
                  nombre: 'Copias ficticias',
                  familia: 'Copiado',
                  cantidad: 1,
                  cantidadUnidad: 'unidad',
                  subtotal: 100,
                  impuestos: 0,
                  total: 100,
                  listoEnMostrador: true,
                },
              },
            },
            include: { items: true },
          });
          const metodo = await tx.metodoPago.create({
            data: {
              tenantId,
              codigo: 'EF',
              nombre: 'Efectivo ficticio',
              tipo: 'efectivo',
            },
          });
          const crearPago = (
            monto: number,
            anulado = false,
            aplicado = false,
          ) =>
            tx.cobro.create({
              data: {
                tenantId,
                ordenId: orden.id,
                fecha: new Date(),
                metodoPagoId: metodo.id,
                montoBruto: monto,
                netoAcreditado: monto,
                disponibleReal: monto,
                anuladoEl: anulado ? new Date() : null,
                ...(aplicado
                  ? {
                      aplicacionesOrden: {
                        create: { tenantId, ordenId: orden.id, monto },
                      },
                    }
                  : {}),
              },
            });
          // Usa las consultas reales del servicio dentro de esta transacción aislada.
          const prisma = new Proxy(tx, {
            get: (target, prop) =>
              prop === '$transaction'
                ? (fn: (db: typeof tx) => unknown) => fn(tx)
                : Reflect.get(target, prop),
          });
          const service = new EntregaService(
            prisma as never,
            {} as never,
            { reconciliarOrden: jest.fn() } as never,
          );
          const auth = {
            tenantId,
            userId: randomUUID(),
            email: 'operador@example.test',
          } as CurrentAuth;
          await tx.user.create({
            data: { id: auth.userId, email: `${auth.userId}@example.test` },
          });
          const payload = {
            itemIds: [orden.items[0].id],
            exigirPagoCompleto: true,
          };
          await crearPago(100, true, true);
          await crearPago(60, false, true);
          await expect(
            service.entregar(auth, orden.id, payload),
          ).rejects.toThrow('100%');
          expect(
            (
              await tx.ordenTrabajoItem.findUniqueOrThrow({
                where: { id: orden.items[0].id },
              })
            ).entregadoEl,
          ).toBeNull();
          await crearPago(39.99);
          await expect(
            service.entregar(auth, orden.id, payload),
          ).rejects.toThrow('100%');
          await crearPago(0.01);
          await expect(
            service.entregar(auth, orden.id, payload),
          ).resolves.toMatchObject({ ordenCerrada: true, entregados: 1 });
          const final = await tx.ordenTrabajo.findUniqueOrThrow({
            where: { id: orden.id },
            include: { items: true, eventos: true },
          });
          expect(final.estado).toBe('entregada');
          expect(final.fechaEntregada).toBeInstanceOf(Date);
          expect(final.items[0].entregadoEl).toBeInstanceOf(Date);
          expect(final.eventos).toHaveLength(1);
          throw rollback;
        },
        { timeout: 15000 },
      ),
    ).rejects.toBe(rollback);
  });
});
