import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RolesGuard } from '../../auth/roles.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import { ImpersonacionGuard } from '../../auth/impersonacion.guard';
import { MetaInboxController } from './meta-inbox.controller';
import { MetaInboxService } from './meta-inbox.service';
import { MetaInboxStreamService } from './meta-inbox-stream.service';
import { Observable } from 'rxjs';
import compression from 'compression';
import type { Server } from 'node:http';
let app: INestApplication<Server>;
const consultar = jest.fn().mockResolvedValue({ mensajes: [] });
const disponibilidad = jest.fn().mockResolvedValue({ disponible: false });
const abrir = jest.fn();
const desconectado = jest.fn();
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [MetaInboxController],
    providers: [
      { provide: MetaInboxService, useValue: { consultar, disponibilidad } },
      { provide: MetaInboxStreamService, useValue: { abrir } },
    ],
  }).compile();
  app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(compression());
  // Identidad sintética. El login real tiene una suite separada.
  app.use(
    (
      req: { headers: Record<string, string>; auth?: unknown },
      _res: unknown,
      next: () => void,
    ) => {
      if (req.headers['x-actor'])
        req.auth = {
          tenantId: 'propia',
          role: req.headers['x-actor'],
          permisos: new Set(
            req.headers['x-sin-permiso'] ? [] : ['configuracion.gestionar'],
          ),
          ...(req.headers['x-impersonacion']
            ? { impersonacion: { sesionId: 's' } }
            : {}),
        };
      next();
    },
  );
  const r = new Reflector();
  app.useGlobalGuards(
    new RolesGuard(r),
    new PermisosGuard(r),
    new ImpersonacionGuard(r),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();
});
beforeEach(() => {
  consultar.mockClear();
  disponibilidad.mockClear();
  abrir.mockReset();
  desconectado.mockClear();
});
afterAll(() => app?.close());
it('el estado del menú sólo consulta disponibilidad y no se almacena en caché', async () => {
  await request(app.getHttpServer())
    .get('/api/integraciones/meta/inbox/disponibilidad')
    .set('x-actor', 'ADMINISTRADOR')
    .expect('Cache-Control', 'no-store')
    .expect(200, { disponible: false });
  expect(disponibilidad).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: 'propia' }),
  );
  expect(consultar).not.toHaveBeenCalled();
});
it.each([
  {},
  { 'x-actor': 'VENDEDOR' },
  { 'x-actor': 'ADMINISTRADOR', 'x-sin-permiso': '1' },
  { 'x-actor': 'ADMINISTRADOR', 'x-impersonacion': '1' },
])('protege también la disponibilidad: %j', async (headers) => {
  await request(app.getHttpServer())
    .get('/api/integraciones/meta/inbox/disponibilidad')
    .set(headers)
    .expect(403);
  expect(disponibilidad).not.toHaveBeenCalled();
});
it('admin autorizado recibe no-store y sólo identidad de sesión', async () => {
  await request(app.getHttpServer())
    .get('/api/integraciones/meta/inbox')
    .set('x-actor', 'ADMINISTRADOR')
    .expect('Cache-Control', 'no-store')
    .expect(200);
  expect(consultar).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: 'propia' }),
    {},
  );
});
it.each([
  {},
  { 'x-actor': 'VENDEDOR' },
  { 'x-actor': 'ADMINISTRADOR', 'x-sin-permiso': '1' },
  { 'x-actor': 'ADMINISTRADOR', 'x-impersonacion': '1' },
])('rechaza acceso no autorizado: %j', async (headers) => {
  await request(app.getHttpServer())
    .get('/api/integraciones/meta/inbox')
    .set(headers)
    .expect(403);
  expect(consultar).not.toHaveBeenCalled();
});
it.each([
  'tenantId=otra',
  'telefono=%2B16505550199',
  'antesDe=no-uuid',
  'clienteId=no-uuid',
])(
  'rechaza parámetro inválido o selector fuera del piloto: %s',
  async (query) => {
    await request(app.getHttpServer())
      .get(`/api/integraciones/meta/inbox?${query}`)
      .set('x-actor', 'ADMINISTRADOR')
      .expect(400);
    expect(consultar).not.toHaveBeenCalled();
  },
);
it('no ofrece acciones de envío', async () => {
  await request(app.getHttpServer())
    .post('/api/integraciones/meta/inbox')
    .set('x-actor', 'ADMINISTRADOR')
    .send({ texto: 'hola' })
    .expect(404);
});
it.each([
  {},
  { 'x-actor': 'OPERADOR' },
  { 'x-actor': 'ADMINISTRADOR', 'x-sin-permiso': '1' },
  { 'x-actor': 'ADMINISTRADOR', 'x-impersonacion': '1' },
])('el stream también exige el acceso del piloto: %j', async (headers) => {
  await request(app.getHttpServer())
    .get('/api/integraciones/meta/inbox/stream')
    .set(headers)
    .expect(403);
  expect(abrir).not.toHaveBeenCalled();
});
it('entrega SSE antes de cerrar, sin compresión ni cache, y libera al desconectar', async () => {
  abrir.mockResolvedValue(
    new Observable((subscriber) => {
      const timer = setTimeout(
        () =>
          subscriber.next({
            type: 'ready',
            id: '7',
            data: { empresaId: 'propia', usuarioId: 'ficticio', revision: '7' },
          }),
        30,
      );
      return () => {
        clearTimeout(timer);
        desconectado();
      };
    }),
  );
  // Socket real para comprobar streaming, no el parser de JSON de supertest.
  if (!app.getHttpServer().listening) await app.listen(0, '127.0.0.1');
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 3000);
  try {
    const response = await fetch(
      `${await app.getUrl()}/api/integraciones/meta/inbox/stream`,
      {
        headers: { 'x-actor': 'ADMINISTRADOR', 'accept-encoding': 'gzip' },
        signal: ctrl.signal,
      },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('content-encoding')).toBeNull();
    const reader = response.body!.getReader();
    let body = '';
    while (!body.includes('event: ready')) {
      const chunk = await reader.read();
      expect(chunk.done).toBe(false);
      body += new TextDecoder().decode(chunk.value);
    }
    expect(body).toContain('id: 7');
    ctrl.abort();
    for (let n = 0; n < 20 && !desconectado.mock.calls.length; n++)
      await new Promise((r) => setTimeout(r, 10));
    expect(desconectado).toHaveBeenCalledTimes(1);
  } finally {
    clearTimeout(timeout);
    ctrl.abort();
  }
});
