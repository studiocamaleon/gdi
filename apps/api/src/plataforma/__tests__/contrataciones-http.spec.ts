import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { ContratacionesPlataformaController } from '../contrataciones-plataforma.controller';
import { ContratacionesPlataformaService } from '../contrataciones-plataforma.service';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import { PrismaService } from '../../prisma/prisma.service';

const id = randomUUID(),
  contratacion = randomUUID();
const url = `/plataforma/suscripciones/${id}/contrataciones`;
const dto = { solicitudId: randomUUID(), motivo: 'Cliente solicita revisión' };
const service = {
  listar: jest.fn(() => ({ total: 0, contrataciones: [] })),
  historial: jest.fn(() => ({ total: 0, eventos: [] })),
  recuperar: jest.fn(() => ({ resultado: 'sin_resultado' })),
};
let rol: 'ADMIN' | 'SOPORTE' | null = 'ADMIN';
let auth: object | undefined;
let app: INestApplication;
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [ContratacionesPlataformaController],
    providers: [
      PlataformaGuard,
      PlataformaAdminGuard,
      { provide: ContratacionesPlataformaService, useValue: service },
      {
        provide: PrismaService,
        useValue: {
          user: {
            findUnique: () =>
              Promise.resolve({ activo: true, rolPlataforma: rol }),
          },
        },
      },
    ],
  }).compile();
  app = module.createNestApplication();
  app.use((req: { auth?: object }, _res: unknown, next: () => void) => {
    req.auth = auth;
    next();
  });
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
  jest.clearAllMocks();
  rol = 'ADMIN';
  auth = {
    userId: randomUUID(),
    esPlataforma: true,
    plataformaMfaPendiente: false,
  };
});
afterAll(() => app.close());
it('las lecturas tienen no-store, paginación validada y acceso de soporte', async () => {
  rol = 'SOPORTE';
  await request(app.getHttpServer() as Server)
    .get(`${url}?pagina=2&limite=10`)
    .expect(200)
    .expect('Cache-Control', 'no-store');
  expect(service.listar).toHaveBeenCalledWith(id, 2, 10);
  await request(app.getHttpServer() as Server)
    .get(`${url}/${contratacion}/historial`)
    .expect(200)
    .expect('Cache-Control', 'no-store');
  await request(app.getHttpServer() as Server)
    .get(`${url}?limite=1000`)
    .expect(400);
  expect(service.recuperar).not.toHaveBeenCalled();
});
it('soporte no puede ejecutar la recuperación', async () => {
  rol = 'SOPORTE';
  await request(app.getHttpServer() as Server)
    .post(`${url}/${contratacion}/consultar`)
    .send(dto)
    .expect(403);
  expect(service.recuperar).not.toHaveBeenCalled();
});
it.each([
  undefined,
  { esPlataforma: false },
  { esPlataforma: true, plataformaMfaPendiente: true },
  { esPlataforma: true, plataformaMfaPendiente: false, impersonacion: {} },
  { esPlataforma: true, plataformaMfaPendiente: false, mcp: {} },
])(
  'rechaza una identidad que no puede entrar a Plataforma: %j',
  async (identidad) => {
    auth = identidad;
    await request(app.getHttpServer() as Server)
      .get(url)
      .expect(identidad ? 403 : 401);
    expect(service.listar).not.toHaveBeenCalled();
  },
);
it('valida referencia, motivo y campos extra antes de ejecutar; ADMIN sí puede consultar', async () => {
  for (const body of [
    { ...dto, transaccionId: 'sub_incorrecta' },
    { ...dto, motivo: '   ' },
    { ...dto, estado: 'aplicada' },
    { ...dto, tenantId: id },
  ]) {
    await request(app.getHttpServer() as Server)
      .post(`${url}/${contratacion}/consultar`)
      .send(body)
      .expect(400);
  }
  expect(service.recuperar).not.toHaveBeenCalled();
  const transaccionId = `txn_${'a'.repeat(26)}`;
  await request(app.getHttpServer() as Server)
    .post(`${url}/${contratacion}/consultar`)
    .send({ ...dto, transaccionId })
    .expect(201)
    .expect('Cache-Control', 'no-store');
  expect(service.recuperar).toHaveBeenCalledWith(auth, id, contratacion, {
    ...dto,
    transaccionId,
  });
});
