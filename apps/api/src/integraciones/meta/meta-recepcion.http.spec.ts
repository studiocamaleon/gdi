import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RolesGuard } from '../../auth/roles.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import { ImpersonacionGuard } from '../../auth/impersonacion.guard';
import { MetaRecepcionController } from './meta-recepcion.controller';
import { MetaRecepcionService } from './meta-recepcion.service';

let app: INestApplication;
const listar = jest.fn().mockResolvedValue({ mensajes: [] });
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [MetaRecepcionController],
    providers: [{ provide: MetaRecepcionService, useValue: { listar } }],
  }).compile();
  app = module.createNestApplication();
  app.setGlobalPrefix('api');
  // Identidad sintética: lo probado aquí son los guards reales de la ruta,
  // no el login/JWT (que tiene su suite propia).
  app.use(
    (
      req: { headers: Record<string, string>; auth?: unknown },
      _res: unknown,
      next: () => void,
    ) => {
      if (req.headers['x-actor'])
        req.auth = {
          role: req.headers['x-actor'],
          tenantId: 'empresa-propia',
          permisos: new Set(
            req.headers['x-sin-permiso'] ? [] : ['configuracion.gestionar'],
          ),
          ...(req.headers['x-impersonacion']
            ? { impersonacion: { sesionId: 'sesion' } }
            : {}),
        };
      next();
    },
  );
  const reflector = new Reflector();
  app.useGlobalGuards(
    new RolesGuard(reflector),
    new PermisosGuard(reflector),
    new ImpersonacionGuard(reflector),
  );
  await app.init();
});
beforeEach(() => listar.mockClear());
afterAll(() => app?.close());
it('permite sólo el administrador autorizado de la sesión, ignorando el tenant de la URL', async () => {
  await request(app.getHttpServer())
    .get('/api/integraciones/meta/recepcion?tenantId=otra')
    .set('x-actor', 'ADMINISTRADOR')
    .expect(200);
  expect(listar).toHaveBeenCalledWith('empresa-propia');
});
it.each([
  {},
  { 'x-actor': 'VENDEDOR' },
  { 'x-actor': 'ADMINISTRADOR', 'x-sin-permiso': '1' },
  { 'x-actor': 'ADMINISTRADOR', 'x-impersonacion': '1' },
])(
  'rechaza identidad/permiso insuficiente o impersonación: %j',
  async (headers) => {
    await request(app.getHttpServer())
      .get('/api/integraciones/meta/recepcion')
      .set(headers)
      .expect(403);
    expect(listar).not.toHaveBeenCalled();
  },
);
