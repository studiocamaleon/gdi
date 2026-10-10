import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppThrottlerGuard } from './app-throttler.guard';
import { LimitesCompartidosService } from './limites-compartidos.service';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

@Controller('ensayo-limite-compartido')
class EnsayoLimiteController {
  @Get() leer() {
    return { ok: true };
  }
}

describe('Límite HTTP compartido entre servidores', () => {
  const apps: INestApplication<Server>[] = [];
  const env = {
    REDIS_URL: process.env.REDIS_URL,
    API_LIMITES_PREFIJO: process.env.API_LIMITES_PREFIJO,
    NODE_ENV: process.env.NODE_ENV,
  };
  const contadores: LimitesCompartidosService[] = [];
  const prefijo = `qa:limites:${randomUUID()}`;
  const redis = new Redis('redis://127.0.0.1:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 0,
  });
  beforeAll(async () => {
    await redis.connect();
  });
  beforeEach(() => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.API_LIMITES_PREFIJO = `${prefijo}:${randomUUID()}`;
  });
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((a) => a.close()));
    contadores.splice(0).forEach((c) => c.onApplicationShutdown());
    process.env.NODE_ENV = env.NODE_ENV;
  });
  afterAll(async () => {
    // Sólo las claves efímeras del ensayo; no usar FLUSHDB en Redis compartido.
    let cursor = '0';
    do {
      const [siguiente, claves] = await redis.scan(
        cursor,
        'MATCH',
        `${prefijo}:*`,
        'COUNT',
        100,
      );
      if (claves.length) await redis.del(...claves);
      cursor = siguiente;
    } while (cursor !== '0');
    redis.disconnect();
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
  async function crear() {
    const modulo = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRootAsync({
          useClass: LimitesCompartidosService,
        }),
      ],
      controllers: [EnsayoLimiteController],
      providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
    }).compile();
    const app = modulo.createNestApplication<INestApplication<Server>>();
    apps.push(app);
    await app.listen(0, '127.0.0.1');
    return request(app.getHttpServer());
  }
  async function contador() {
    const c = new LimitesCompartidosService();
    contadores.push(c);
    await c.onModuleInit();
    return c;
  }
  it('no permite renovar el cupo alternando entre dos instancias', async () => {
    const [a, b] = await Promise.all([crear(), crear()]);
    for (let i = 0; i < 100; i++)
      await (i % 2 ? a : b).get('/ensayo-limite-compartido').expect(200);
    await a.get('/ensayo-limite-compartido').expect(429);
    await b
      .get('/ensayo-limite-compartido')
      .set('Authorization', 'Bearer falso')
      .set('X-Forwarded-For', '203.0.113.2')
      .expect(429);
  });
  it('las solicitudes concurrentes sólo admiten el cupo compartido', async () => {
    const [a, b] = await Promise.all([crear(), crear()]);
    const respuestas = await Promise.all(
      Array.from({ length: 120 }, (_, i) =>
        (i % 2 ? a : b).get('/ensayo-limite-compartido'),
      ),
    );
    expect(respuestas.filter((r) => r.status === 200)).toHaveLength(100);
    expect(respuestas.filter((r) => r.status === 429)).toHaveLength(20);
    expect(
      respuestas.find((r) => r.status === 429)?.headers['retry-after'],
    ).toBeDefined();
  });
  it('reiniciar la instancia no reinicia el cupo', async () => {
    const a = await crear();
    for (let i = 0; i < 100; i++)
      await a.get('/ensayo-limite-compartido').expect(200);
    await apps.pop()!.close();
    await (await crear()).get('/ensayo-limite-compartido').expect(429);
  });
  it('un contador inaccesible devuelve 503 sin continuar al controlador', async () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:1';
    await (await crear()).get('/ensayo-limite-compartido').expect(503);
  });
  it('producción no inicia sin un contador compartido configurado', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    expect(() => new LimitesCompartidosService()).toThrow('requiere REDIS_URL');
  });
  it('rechaza URL inválida sin exponerla', () => {
    process.env.REDIS_URL = 'https://ficticio:secreto@example.invalid';
    expect(() => new LimitesCompartidosService()).toThrow(
      'REDIS_URL debe usar',
    );
  });
  it('el local sin Redis mantiene su límite en memoria y libera temporizadores', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.REDIS_URL;
    const c = await contador();
    expect(
      (await c.increment('ficticio', 1000, 1, 1000, 'default')).isBlocked,
    ).toBe(false);
    expect(
      (await c.increment('ficticio', 1000, 1, 1000, 'default')).isBlocked,
    ).toBe(true);
  });
  it('los cupos vencen y los rechazos no prolongan el bloqueo', async () => {
    const c = await contador();
    expect(
      (await c.increment('caducidad', 80, 1, 80, 'default')).isBlocked,
    ).toBe(false);
    await new Promise((r) => setTimeout(r, 120));
    expect(
      (await c.increment('caducidad', 80, 1, 80, 'default')).isBlocked,
    ).toBe(false);
    expect(
      (await c.increment('caducidad', 80, 1, 80, 'default')).isBlocked,
    ).toBe(true);
    await new Promise((r) => setTimeout(r, 45));
    expect(
      (await c.increment('caducidad', 80, 1, 80, 'default')).isBlocked,
    ).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(
      (await c.increment('caducidad', 80, 1, 80, 'default')).isBlocked,
    ).toBe(false);
  });
  it('separa rutas, contadores y entornos aunque usen el mismo Redis', async () => {
    const a = await contador();
    await a.increment('ruta-a', 1000, 1, 1000, 'default');
    expect(
      (await a.increment('ruta-a', 1000, 1, 1000, 'default')).isBlocked,
    ).toBe(true);
    expect(
      (await a.increment('ruta-b', 1000, 1, 1000, 'default')).isBlocked,
    ).toBe(false);
    expect((await a.increment('ruta-a', 1000, 1, 1000, 'otro')).isBlocked).toBe(
      false,
    );
    process.env.API_LIMITES_PREFIJO += ':otro';
    const b = await contador();
    expect(
      (await b.increment('ruta-a', 1000, 1, 1000, 'default')).isBlocked,
    ).toBe(false);
  });
});
