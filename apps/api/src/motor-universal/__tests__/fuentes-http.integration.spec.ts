import { randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { json } from 'express';
import request from 'supertest';
import { MotorUniversalController } from '../motor.controller';
import { MotorUniversalService } from '../motor.service';
import { GeometriaVectorialCacheService } from '../geometria-vectorial/geometria-vectorial-cache.service';
import { AnalisisVectorialAsyncService } from '../geometria-vectorial/analisis-vectorial-async.service';
import { CotizacionJobsService } from '../../workers/cotizacion/cotizacion-jobs.service';
import { CotizacionWorker } from '../../workers/cotizacion/cotizacion.worker';
import { TenantConcurrencyService } from '../../workers/tenant-concurrency.service';
import { Queue, QueueEvents } from 'bullmq';
import { AplicarPrecioService } from '../../productos-servicios/precio/aplicar-precio.service';
import { PreciosEspecialesClientesService } from '../../productos-servicios/precio/precios-especiales-clientes/precios-especiales-clientes.service';
import {
  inspeccionarVector,
  interpretarVector,
} from '../../productos-servicios/geometrias/interpretar-vector';
import { serializarCotizacion } from '../../../../../src/lib/fuentes-geometria-transporte';

describe('fuentes grandes por HTTP y persistencia real', () => {
  const db = new PrismaClient();
  // JSONB/Prisma pueden cambiar el último bit de un double. La tolerancia es
  // 0,00000001 mm; identidades, capas, cantidad y estructura se comparan exactas.
  const geometriaComparable = (value: unknown) =>
    JSON.parse(
      JSON.stringify(value, (_key, v) =>
        typeof v === 'number' ? Number(v.toFixed(8)) : v,
      ),
    );
  afterAll(() => db.$disconnect());

  it('cotiza, guarda y recotiza seis archivos por referencia y conserva el contexto completo al reabrir', async () => {
    const rollback = new Error('rollback fuentes HTTP');
    await expect(
      db.$transaction(
        async (tx) => {
          const { id: tenantId } = await tx.tenant.findUniqueOrThrow({
            where: { slug: 'gdi-demo' },
          });
          const producto = await tx.producto.findFirstOrThrow({
            where: { tenantId, codigo: 'TARJ-PREMIUM-300' },
          });
          const puntos = Array.from(
            { length: 1000 },
            (_, i) =>
              `${50 + 40 * Math.cos((i * Math.PI) / 500)},${50 + 40 * Math.sin((i * Math.PI) / 500)}`,
          ).join(' ');
          const svg = `<svg viewBox="0 0 100 100"><polygon points="${puntos}"/></svg>`;
          const inspeccion = inspeccionarVector(svg, 'grande.svg');
          const fuentes: Record<string, unknown> = {};
          for (let i = 0; i < 6; i++) {
            const geometriaId = randomUUID(),
              archivoId = randomUUID();
            const f = JSON.parse(
              JSON.stringify(
                interpretarVector(
                  inspeccion,
                  {
                    exteriorId: inspeccion.sugeridaId,
                    unidad: 'mm',
                    cerrarExterior: false,
                    operaciones: [],
                  },
                  {
                    geometriaId,
                    archivoId,
                    hash: 'a'.repeat(64),
                    nombreArchivo: `pieza-${i}.svg`,
                  },
                ),
              ),
            );
            await tx.archivo.create({
              data: {
                id: archivoId,
                tenantId,
                productoId: producto.id,
                scope: 'PRODUCTO',
                key: `prueba-f4-fuente-${archivoId}`,
                nombreOriginal: f.nombreArchivo,
                mimeType: 'image/svg+xml',
                estado: 'LISTO',
                hash: f.procedencia.hash,
              },
            });
            await tx.geometriaProducto.create({
              data: {
                id: geometriaId,
                tenantId,
                productoId: producto.id,
                archivoId,
                hash: f.procedencia.hash,
                fuenteJson: f,
                interpretacionJson: {},
              },
            });
            fuentes[`pieza${i}`] = f;
          }
          const prisma = new Proxy(tx, {
            get(target, prop) {
              return prop === '$transaction'
                ? (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)
                : Reflect.get(target, prop);
            },
          });
          const motor = new MotorUniversalService(
            prisma as never,
            new AplicarPrecioService(),
            new PreciosEspecialesClientesService(prisma as never),
          );
          const cotizacionesAsync = new CotizacionJobsService();
          const module = await Test.createTestingModule({
            controllers: [MotorUniversalController],
            providers: [
              { provide: MotorUniversalService, useValue: motor },
              { provide: GeometriaVectorialCacheService, useValue: {} },
              { provide: AnalisisVectorialAsyncService, useValue: {} },
              { provide: CotizacionJobsService, useValue: cotizacionesAsync },
            ],
          }).compile();
          const app = module.createNestApplication({
            bodyParser: false,
            logger: false,
          });
          app.use(json({ limit: '1mb' }));
          app.use((req: any, _res: unknown, next: () => void) => {
            if (req.headers['x-prueba-auth'])
              req.auth = { tenantId, userId: randomUUID() };
            next();
          });
          app.useGlobalPipes(
            new ValidationPipe({
              whitelist: true,
              forbidNonWhitelisted: true,
              transform: true,
            }),
          );
          await app.init();
          try {
            const payload = {
              productoId: producto.id,
              periodo: '2026-06',
              jobContext: {
                cantidad: 500,
                caras: 2,
                geometriasVectoriales: fuentes,
              },
            };
            const post = (path: string, body: string) =>
              request(app.getHttpServer())
                .post(path)
                .set('x-prueba-auth', '1')
                .set('Content-Type', 'application/json')
                .send(body);
            const completo = await post(
              '/motor-universal/cotizar',
              JSON.stringify(payload),
            );
            expect(completo.status).toBe(201);
            expect(completo.body.exitoso).toBe(true);
            const body = serializarCotizacion(payload);
            expect(Buffer.byteLength(body)).toBeLessThan(3000);
            const guardada = await post(
              '/motor-universal/cotizar-y-guardar',
              body,
            );
            expect(guardada.status).toBe(201);
            expect(guardada.body.result.exitoso).toBe(true);
            const itemId = guardada.body.cotizacionItemId;
            expect(itemId).toBeTruthy();
            const antes = await tx.cotizacionItem.findUniqueOrThrow({
              where: { id: itemId },
            });
            expect(
              geometriaComparable(
                (antes.jobContextJson as any).geometriasVectoriales,
              ),
            ).toEqual(geometriaComparable(fuentes));
            const recotizada = await request(app.getHttpServer())
              .patch(`/motor-universal/cotizacion-items/${itemId}/recotizar`)
              .set('x-prueba-auth', '1')
              .set('Content-Type', 'application/json')
              .send(
                serializarCotizacion({
                  periodo: '2026-06',
                  jobContext: { ...payload.jobContext, cantidad: 200 },
                }),
              );
            expect(recotizada.status).toBe(200);
            expect(recotizada.body.result.exitoso).toBe(true);
            const despues = await tx.cotizacionItem.findUniqueOrThrow({
              where: { id: itemId },
            });
            expect(Number(despues.cantidad)).toBe(200);
            expect(
              geometriaComparable(
                (despues.jobContextJson as any).geometriasVectoriales,
              ),
            ).toEqual(geometriaComparable(fuentes));
            expect((despues.snapshotJson as any).motor.inputHash).not.toBe(
              (antes.snapshotJson as any).motor.inputHash,
            );
            if (process.env.F4_QUOTE_WORKER_INTEGRATION === '1') {
              // Instancia Redis efímera dedicada; nunca la cola de desarrollo.
              const redis = new URL(process.env.REDIS_URL!);
              expect(redis.hostname).toBe('127.0.0.1');
              expect(redis.port).not.toBe('6379');
              const connection = { url: redis.toString(), maxRetriesPerRequest: null };
              const queue = new Queue('grafo-quotes-v1', { connection });
              const events = new QueueEvents('grafo-quotes-v1', { connection });
              const concurrencia = new TenantConcurrencyService();
              const worker = new CotizacionWorker(motor, concurrencia);
              try {
                await events.waitUntilReady();
                await worker.onApplicationBootstrap();
                const solicitud = JSON.parse(body);
                solicitud.claveSolicitud = randomUUID();
                const creada = await post('/motor-universal/cotizar-asincrono', JSON.stringify(solicitud));
                expect(creada.status).toBe(202);
                const job = await queue.getJob(creada.body.id);
                expect(job).toBeDefined();
                expect(Buffer.byteLength(JSON.stringify(job!.data.input.jobContext))).toBeLessThan(3000);
                const resultado = await job!.waitUntilFinished(events, 15000);
                expect(resultado.exitoso).toBe(true);
                expect(resultado.cotizacion.costos.total).toBe(completo.body.cotizacion.costos.total);
                expect((await cotizacionesAsync.consultar(tenantId, creada.body.id)).estado).toBe('completado');
                await expect(cotizacionesAsync.consultar(randomUUID(), creada.body.id)).rejects.toThrow(/No se encontró/);
                const repetida = await post('/motor-universal/cotizar-asincrono', JSON.stringify(solicitud));
                expect(repetida.body.id).toBe(creada.body.id);
                await job!.remove();
              } finally {
                await worker.onApplicationShutdown();
                await concurrencia.onApplicationShutdown();
                await events.close();
                await queue.close();
              }
            }
            const adulterada = JSON.parse(body);
            adulterada.jobContext.geometriasVectoriales.pieza0.procedencia.hash =
              'b'.repeat(64);
            expect(
              (
                await post(
                  '/motor-universal/cotizar-y-guardar',
                  JSON.stringify(adulterada),
                )
              ).status,
            ).toBe(400);
            expect(
              (
                await request(app.getHttpServer())
                  .post('/motor-universal/cotizar')
                  .send(payload)
              ).status,
            ).toBe(401);
          } finally {
            await app.close();
          }
          throw rollback;
        },
        { timeout: 30_000 },
      ),
    ).rejects.toBe(rollback);
    expect(
      await db.archivo.count({
        where: { key: { startsWith: 'prueba-f4-fuente-' } },
      }),
    ).toBe(0);
  }, 35_000);
});
