import { MetaEquipoService } from './inbox/meta-equipo.service';
import { MetaCargasService } from './inbox/meta-cargas.service';
import { MetaEnviosService } from './inbox/meta-envios.service';
import { MetaAdjuntosService } from './inbox/meta-adjuntos.service';
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
const abrirAdjunto = jest
  .fn()
  .mockResolvedValue({ url: 'https://files.example.invalid/privado' });
const abrirArchivoPlantilla = jest.fn().mockResolvedValue({
  url: 'https://files.example.invalid/pdf',
  statusCode: 302,
});
const archivosPlantilla = jest.fn().mockResolvedValue({ archivos: [] });
const catalogo = jest.fn().mockResolvedValue({ plantillas: [] });
const enviarPlantilla = jest.fn().mockResolvedValue({ estado: 'ACEPTADO' });
const enviar = jest.fn().mockResolvedValue({ estado: 'ACEPTADO' });
const consultar = jest.fn().mockResolvedValue({ mensajes: [] });
const disponibilidad = jest.fn().mockResolvedValue({ disponible: false });
const abrir = jest.fn();
const desconectado = jest.fn();
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [MetaInboxController],
    providers: [
      { provide: MetaCargasService, useValue: {} },
      {
        provide: MetaEquipoService,
        useValue: { guardar: jest.fn().mockResolvedValue({ guardado: true }) },
      },
      {
        provide: MetaEnviosService,
        useValue: {
          enviar,
          catalogo,
          enviarPlantilla,
          archivosPlantilla,
          abrirArchivoPlantilla,
        },
      },
      { provide: MetaAdjuntosService, useValue: { abrir: abrirAdjunto } },
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
            req.headers['x-sin-permiso']
              ? []
              : req.headers['x-inbox']
                ? ['inbox.atender']
                : req.headers['x-actor'] === 'ADMINISTRADOR'
                  ? ['configuracion.gestionar']
                  : [],
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
  enviar.mockClear();
  abrirAdjunto.mockClear();
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
    expect.any(String),
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
    expect.any(String),
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
  'conversacionId=no-uuid',
  'desdeId=no-uuid',
  'listaAntesDe=%7B%7D',
  `busqueda=${'x'.repeat(121)}`,
])(
  'rechaza parámetro inválido o selector de otro ámbito: %s',
  async (query) => {
    await request(app.getHttpServer())
      .get(`/api/integraciones/meta/inbox?${query}`)
      .set('x-actor', 'ADMINISTRADOR')
      .expect(400);
    expect(consultar).not.toHaveBeenCalled();
  },
);
it('acepta los selectores de lectura general sin permitir elegir empresa ni teléfono', async () => {
  const query = {
    conversacionId: '11111111-1111-4111-8111-111111111111',
    desdeId: '22222222-2222-4222-8222-222222222222',
    busqueda: 'Alma',
  };
  await request(app.getHttpServer())
    .get('/api/integraciones/meta/inbox')
    .query(query)
    .set('x-actor', 'ADMINISTRADOR')
    .expect('Cache-Control', 'no-store')
    .expect(200);
  expect(consultar).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: 'propia' }),
    query,
    expect.any(String),
  );
});
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

it('adjunto exige permisos, valida UUID y usa empresa de sesión', async () => {
  const ruta =
    '/api/integraciones/meta/inbox/mensajes/00000000-0000-4000-8000-000000000001/adjunto';
  await request(app.getHttpServer())
    .get(ruta)
    .set('x-actor', 'VENDEDOR')
    .expect(403);
  expect(abrirAdjunto).not.toHaveBeenCalled();
  await request(app.getHttpServer())
    .get(ruta.replace('00000000-0000-4000-8000-000000000001', 'incorrecto'))
    .set('x-actor', 'ADMINISTRADOR')
    .expect(400);
  expect(abrirAdjunto).not.toHaveBeenCalled();
  await request(app.getHttpServer())
    .get(ruta)
    .set('x-actor', 'ADMINISTRADOR')
    .expect('Cache-Control', 'private, no-store')
    .expect(200);
  expect(abrirAdjunto).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: 'propia' }),
    expect.any(String),
    '00000000-0000-4000-8000-000000000001',
  );
});
const textoUrl =
  '/api/integraciones/meta/inbox/conversaciones/11111111-1111-4111-8111-111111111111/texto';
const textoDto = {
  clave: '22222222-2222-4222-8222-222222222222',
  canalId:
    '33333333-3333-4333-8333-333333333333:44444444-4444-4444-8444-444444444444',
  texto: 'Hola',
};
it('POST de texto valida identidad, delega sólo el DTO y prohíbe caché', async () => {
  await request(app.getHttpServer())
    .post(textoUrl)
    .set('x-actor', 'ADMINISTRADOR')
    .send(textoDto)
    .expect('Cache-Control', 'private, no-store')
    .expect(200);
  expect(enviar).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: 'propia' }),
    expect.any(String),
    '11111111-1111-4111-8111-111111111111',
    textoDto,
  );
});
it.each([
  {},
  { 'x-actor': 'VENDEDOR' },
  { 'x-actor': 'ADMINISTRADOR', 'x-sin-permiso': '1' },
  { 'x-actor': 'ADMINISTRADOR', 'x-impersonacion': '1' },
])('POST impide acceso sin privilegios: %j', async (headers) => {
  await request(app.getHttpServer())
    .post(textoUrl)
    .set(headers)
    .send(textoDto)
    .expect(403);
  expect(enviar).not.toHaveBeenCalled();
});
it.each([
  { ...textoDto, telefono: '+16505550999' },
  { ...textoDto, texto: ' ' },
  { ...textoDto, texto: 'a'.repeat(4097) },
  { ...textoDto, clave: 'invalida' },
  { ...textoDto, canalId: 'invalido' },
])('POST rechaza datos inválidos o destinatario impuesto: %j', async (body) => {
  await request(app.getHttpServer())
    .post(textoUrl)
    .set('x-actor', 'ADMINISTRADOR')
    .send(body)
    .expect(400);
  expect(enviar).not.toHaveBeenCalled();
});

const rutaPlantilla =
  '/api/integraciones/meta/inbox/conversaciones/11111111-1111-4111-8111-111111111111/plantilla';
const pedidoPlantilla = {
  clave: '22222222-2222-4222-8222-222222222222',
  canalId:
    '11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222',
  plantillaId: '123',
  version: 'a'.repeat(64),
  valores: ['Alma'],
  consentimientoConfirmado: true,
};
it('valida POST de plantilla y lo entrega sin caché', async () => {
  await request(app.getHttpServer())
    .post(rutaPlantilla)
    .set('x-actor', 'ADMINISTRADOR')
    .send(pedidoPlantilla)
    .expect(200)
    .expect('Cache-Control', 'private, no-store');
  expect(enviarPlantilla).toHaveBeenCalled();
});
it.each([
  { telefono: '+16505550123' },
  { tenantId: 'ajeno' },
  { valores: [{}] },
  { consentimientoConfirmado: false },
  { version: 'alterado' },
  { pagina: 'x'.repeat(2049) },
])('rechaza payload de plantilla inválido: %j', async (cambio) => {
  const prev = enviarPlantilla.mock.calls.length;
  await request(app.getHttpServer())
    .post(rutaPlantilla)
    .set('x-actor', 'ADMINISTRADOR')
    .send({ ...pedidoPlantilla, ...cambio })
    .expect(400);
  expect(enviarPlantilla.mock.calls.length).toBe(prev);
});
it.each([
  { 'x-actor': 'VENDEDOR' },
  { 'x-actor': 'ADMINISTRADOR', 'x-sin-permiso': '1' },
  { 'x-actor': 'ADMINISTRADOR', 'x-impersonacion': '1' },
])('catálogo y envío conservan los permisos del Inbox: %j', async (headers) => {
  await request(app.getHttpServer())
    .get('/api/integraciones/meta/inbox/plantillas')
    .set(headers)
    .query({ canalId: pedidoPlantilla.canalId })
    .expect(403);
  await request(app.getHttpServer())
    .post(rutaPlantilla)
    .set(headers)
    .send(pedidoPlantilla)
    .expect(403);
});

it('el selector de archivos exige el mismo acceso y rechaza tenant/URL suministrados por cliente', async () => {
  const ruta = textoUrl.replace('/texto', '/archivos-plantilla');
  await request(app.getHttpServer())
    .get(ruta)
    .query({ canalId: textoDto.canalId })
    .set('x-actor', 'OPERADOR')
    .expect(403);
  await request(app.getHttpServer())
    .get(ruta)
    .query({ canalId: textoDto.canalId, tenantId: 'ajena' })
    .set('x-actor', 'ADMINISTRADOR')
    .expect(400);
  await request(app.getHttpServer())
    .get(ruta)
    .query({ canalId: textoDto.canalId })
    .set('x-actor', 'ADMINISTRADOR')
    .expect('Cache-Control', 'private, no-store')
    .expect(200);
  expect(archivosPlantilla).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: 'propia' }),
    expect.any(String),
    '11111111-1111-4111-8111-111111111111',
    { canalId: textoDto.canalId },
  );
});

it('abrir un documento exige identidad, versión y acceso y no permite cambiar de tenant', async () => {
  const ruta =
    '/api/integraciones/meta/inbox/conversaciones/11111111-1111-4111-8111-111111111111/archivos-plantilla/22222222-2222-4222-8222-222222222222';
  const query = { canalId: textoDto.canalId, version: 'a'.repeat(64) };
  await request(app.getHttpServer()).get(ruta).query(query).expect(403);
  await request(app.getHttpServer())
    .get(ruta)
    .query(query)
    .set('x-actor', 'OPERADOR')
    .expect(403);
  await request(app.getHttpServer())
    .get(ruta)
    .query(query)
    .set('x-actor', 'ADMINISTRADOR')
    .set('x-impersonacion', '1')
    .expect(403);
  await request(app.getHttpServer())
    .get(ruta)
    .query({ ...query, version: 'otra' })
    .set('x-actor', 'ADMINISTRADOR')
    .expect(400);
  await request(app.getHttpServer())
    .get(ruta)
    .query({ ...query, tenantId: 'ajena' })
    .set('x-actor', 'ADMINISTRADOR')
    .expect(400);
  await request(app.getHttpServer())
    .get(ruta)
    .query(query)
    .set('x-actor', 'ADMINISTRADOR')
    .expect('Cache-Control', 'private, no-store')
    .expect('Location', 'https://files.example.invalid/pdf')
    .expect(302);
  expect(abrirArchivoPlantilla).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: 'propia' }),
    expect.any(String),
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    query,
  );
});

it('admite un operador con permiso de atención y valida las notas sin permitir autoría enviada por el cliente', async () => {
  await request(app.getHttpServer())
    .get('/api/integraciones/meta/inbox')
    .set('x-actor', 'OPERADOR')
    .set('x-inbox', '1')
    .expect(200);
  const ruta =
    '/api/integraciones/meta/inbox/conversaciones/11111111-1111-4111-8111-111111111111/notas';
  const dto = {
    clave: '22222222-2222-4222-8222-222222222222',
    canalId: 'canal',
    texto: 'Nota interna',
  };
  await request(app.getHttpServer())
    .post(ruta)
    .set('x-actor', 'OPERADOR')
    .set('x-inbox', '1')
    .send(dto)
    .expect(200);
  await request(app.getHttpServer())
    .post(ruta)
    .set('x-actor', 'OPERADOR')
    .set('x-inbox', '1')
    .send({ ...dto, actorId: 'otro' })
    .expect(400);
  await request(app.getHttpServer())
    .post(ruta)
    .set('x-actor', 'OPERADOR')
    .set('x-inbox', '1')
    .send({ ...dto, texto: '   ' })
    .expect(400);
});

it('valida lectura compartida y estados, sin aceptar usuarios ni revisiones arbitrarias', async () => {
  const lectura = textoUrl.replace('/texto', '/lectura');
  const estado = textoUrl.replace('/texto', '/estado');
  const base = { canalId: textoDto.canalId, revision: 3 };
  await request(app.getHttpServer())
    .post(lectura)
    .set('x-actor', 'OPERADOR')
    .set('x-inbox', '1')
    .send(base)
    .expect(200)
    .expect('Cache-Control', 'private, no-store');
  for (const cambio of [
    { revision: -1 },
    { revision: 1.5 },
    { revision: '3' },
    { usuarioId: 'otro' },
    { tenantId: 'ajeno' },
  ])
    await request(app.getHttpServer())
      .post(lectura)
      .set('x-actor', 'ADMINISTRADOR')
      .send({ ...base, ...cambio })
      .expect(400);
  const dto = {
    ...base,
    clave: textoDto.clave,
    estado: 'RESUELTA',
    version: 0,
  };
  await request(app.getHttpServer())
    .post(estado)
    .set('x-actor', 'OPERADOR')
    .set('x-inbox', '1')
    .send(dto)
    .expect(200);
  await request(app.getHttpServer())
    .post(estado)
    .set('x-actor', 'ADMINISTRADOR')
    .send({ ...dto, estado: 'BORRADA' })
    .expect(400);
  await request(app.getHttpServer()).post(estado).send(dto).expect(403);
});
it('valida la combinación de filtros sin aceptar estados o booleanos desconocidos', async () => {
  const ruta = '/api/integraciones/meta/inbox';
  await request(app.getHttpServer())
    .get(ruta)
    .set('x-actor', 'ADMINISTRADOR')
    .query({
      filtro: 'MIAS',
      estados: 'ACTIVA',
      sinLeer: 'true',
      sinResponder: 'true',
      participe: 'true',
    })
    .expect(200);
  for (const query of [
    { estados: 'CERRADA' },
    { estados: 'ACTIVA,RESUELTA' },
    { filtro: 'MIAS,SIN_ASIGNAR' },
    { estados: 'ACTIVA,RESUELTA,ACTIVA' },
    { sinLeer: 'si' },
    { sinResponder: 'false' },
  ])
    await request(app.getHttpServer())
      .get(ruta)
      .set('x-actor', 'ADMINISTRADOR')
      .query(query)
      .expect(400);
});
