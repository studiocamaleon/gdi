import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RolesGuard } from '../../auth/roles.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import { ImpersonacionGuard } from '../../auth/impersonacion.guard';
import { MetaInboxController } from './meta-inbox.controller';
import { MetaInboxService } from './meta-inbox.service';
let app: INestApplication;
const consultar = jest.fn().mockResolvedValue({ mensajes: [] });
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [MetaInboxController],
    providers: [{ provide: MetaInboxService, useValue: { consultar } }],
  }).compile();
  app = module.createNestApplication();
  app.setGlobalPrefix('api');
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
beforeEach(() => consultar.mockClear());
afterAll(() => app?.close());
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
