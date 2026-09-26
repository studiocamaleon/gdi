import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RolesGuard } from '../../auth/roles.guard';
import { PermisosGuard } from '../../auth/permisos.guard';
import { ImpersonacionGuard } from '../../auth/impersonacion.guard';
import { MetaConexionController } from './meta-conexion.controller';
import { MetaConexionService } from './meta-conexion.service';
import type { Server } from 'node:http';
const tenant = '01000000-0000-4000-8000-000000000001';
const intento = {
  id: '01000000-0000-4000-8000-000000000002',
  estadoSecreto: 'A'.repeat(43),
};
const envKeys = [
  'META_CONEXION_MODO',
  'META_CONEXION_TENANT_IDS',
  'META_INBOX_RECEPCION_ENABLED',
] as const;
const env = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
const service = {
  estado: jest.fn(),
  preparar: jest.fn(),
  consultar: jest.fn(),
  canjear: jest.fn(),
  verificar: jest.fn(),
  cancelar: jest.fn(),
};
let app: INestApplication<Server>;
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [MetaConexionController],
    providers: [{ provide: MetaConexionService, useValue: service }],
  }).compile();
  app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(
    (
      req: { headers: Record<string, string>; auth?: unknown },
      _res: unknown,
      next: () => void,
    ) => {
      if (req.headers['x-actor'])
        req.auth = {
          tenantId: tenant,
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
  const reflector = new Reflector();
  app.useGlobalGuards(
    new RolesGuard(reflector),
    new PermisosGuard(reflector),
    new ImpersonacionGuard(reflector),
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
  for (const mock of Object.values(service))
    mock.mockReset().mockResolvedValue({ estado: 'PREPARADA' });
  Object.assign(process.env, {
    META_CONEXION_MODO: 'sandbox',
    META_CONEXION_TENANT_IDS: tenant,
    META_INBOX_RECEPCION_ENABLED: 'false',
  });
});
afterAll(async () => {
  await app.close();
  for (const k of envKeys) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
});
const path = '/api/integraciones/meta/conexion';
it('consultar estado no dispara altas ni canjes y responde no-store', async () => {
  await request(app.getHttpServer())
    .get(path)
    .set('x-actor', 'ADMINISTRADOR')
    .expect('Cache-Control', 'no-store')
    .expect(200);
  expect(service.estado).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: tenant }),
    expect.any(String),
  );
  expect(service.preparar).not.toHaveBeenCalled();
});
it.each([
  {},
  { 'x-actor': 'VENDEDOR' },
  { 'x-actor': 'ADMINISTRADOR', 'x-sin-permiso': '1' },
  { 'x-actor': 'ADMINISTRADOR', 'x-impersonacion': '1' },
])('protege lectura y escritura: %j', async (headers) => {
  await request(app.getHttpServer()).get(path).set(headers).expect(403);
  await request(app.getHttpServer())
    .post(`${path}/preparar`)
    .set(headers)
    .send({})
    .expect(403);
  expect(service.estado).not.toHaveBeenCalled();
  expect(service.preparar).not.toHaveBeenCalled();
});
it.each(['preparar', 'canjear', 'verificar'] as const)(
  'flag y allowlist impiden %s',
  async (ruta) => {
    process.env.META_CONEXION_TENANT_IDS = '';
    const body =
      ruta === 'preparar'
        ? {}
        : ruta === 'canjear'
          ? { ...intento, codigo: 'codigo' }
          : { ...intento, wabaId: '200001' };
    await request(app.getHttpServer())
      .post(`${path}/${ruta}`)
      .set('x-actor', 'ADMINISTRADOR')
      .send(body)
      .expect(503);
    expect(service[ruta]).not.toHaveBeenCalled();
  },
);
it('coexistencia requiere recepción habilitada además del permiso por empresa', async () => {
  process.env.META_CONEXION_MODO = 'coexistencia';
  await request(app.getHttpServer())
    .post(`${path}/preparar`)
    .set('x-actor', 'ADMINISTRADOR')
    .send({})
    .expect(503);
});
it.each([
  ['preparar', { tenantId: 'ajeno' }],
  ['canjear', { ...intento, codigo: 'x', tenantId: 'ajeno' }],
  ['verificar', { ...intento, wabaId: 'https://ajeno' }],
  ['consultar', { ...intento, estadoSecreto: 'corto' }],
  ['cancelar', { ...intento, id: 'no-uuid' }],
])('rechaza entradas inválidas en %s', async (ruta, body) => {
  await request(app.getHttpServer())
    .post(`${path}/${ruta}`)
    .set('x-actor', 'ADMINISTRADOR')
    .send(body)
    .expect(400);
});
it('canje usa sólo la identidad autenticada y no permite secretos en GET', async () => {
  await request(app.getHttpServer())
    .post(`${path}/canjear`)
    .set('x-actor', 'ADMINISTRADOR')
    .send({ ...intento, codigo: 'codigo' })
    .expect('Cache-Control', 'no-store')
    .expect(200);
  expect(service.canjear).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: tenant }),
    expect.any(String),
    expect.objectContaining(intento),
    'codigo',
  );
  await request(app.getHttpServer())
    .get(`${path}/canjear`)
    .set('x-actor', 'ADMINISTRADOR')
    .expect(404);
});
it('cancelar sigue disponible si se apagó el alta', async () => {
  process.env.META_CONEXION_MODO = '';
  await request(app.getHttpServer())
    .post(`${path}/cancelar`)
    .set('x-actor', 'ADMINISTRADOR')
    .send(intento)
    .expect(200);
  expect(service.cancelar).toHaveBeenCalledTimes(1);
});
