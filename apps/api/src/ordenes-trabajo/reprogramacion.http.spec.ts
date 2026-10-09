import { Test } from '@nestjs/testing';
import {
  ForbiddenException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { ReprogramacionController } from './reprogramacion.controller';
import { ReprogramacionService } from './reprogramacion.service';
import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
import { PermisosGuard } from '../auth/permisos.guard';
import type { CurrentAuth } from '../auth/auth.types';
const servicio = {
  simular: jest.fn(async () => ({ viable: true })),
  confirmar: jest.fn(async () => ({ confirmado: true })),
};
const capacidades = { exigirIncluida: jest.fn(async () => {}) };
const baseAuth: CurrentAuth = {
  userId: randomUUID(),
  tenantId: randomUUID(),
  sessionId: randomUUID(),
  membershipId: randomUUID(),
  role: 'ADMINISTRADOR',
  email: 'qa@example.invalid',
  permisos: new Set(['produccion.planificacion.ver']),
};
let app: INestApplication, auth: CurrentAuth | undefined;
const ruta = `/ordenes-trabajo/tablero/pasos/${randomUUID()}/reprogramacion`;
beforeAll(async () => {
  const modulo = await Test.createTestingModule({
    controllers: [ReprogramacionController],
    providers: [
      { provide: ReprogramacionService, useValue: servicio },
      { provide: CapacidadesEmpresaService, useValue: capacidades },
    ],
  }).compile();
  app = modulo.createNestApplication();
  app.use((req: { auth?: CurrentAuth }, _res: unknown, next: () => void) => {
    req.auth = auth;
    next();
  });
  app.useGlobalGuards(new PermisosGuard(new Reflector()));
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
  auth = { ...baseAuth, permisos: new Set(['produccion.planificacion.ver']) };
});
afterAll(() => app.close());
it('valida el contrato y no acepta IDs ni ventanas de agenda provistos por el cliente', async () => {
  const s = {
    tipo: 'produccion',
    alcance: 'paso',
    fecha: '2099-01-10',
    hora: '10:00',
  };
  await request(app.getHttpServer())
    .post(`${ruta}/simular`)
    .send({ ...s, tenantId: randomUUID(), planificadoHasta: '2099-01-10' })
    .expect(400);
  await request(app.getHttpServer())
    .post(`${ruta}/simular`)
    .send({ ...s, alcance: 'orden' })
    .expect(400);
  expect(servicio.simular).not.toHaveBeenCalled();
  await request(app.getHttpServer())
    .post(`${ruta}/simular`)
    .send(s)
    .expect(201);
  expect(servicio.simular).toHaveBeenCalledWith(
    expect.objectContaining({ tenantId: baseAuth.tenantId }),
    expect.any(String),
    s,
  );
  await request(app.getHttpServer())
    .post(`${ruta}/confirmar`)
    .send({ token: 'x', motivo: 'a'.repeat(501) })
    .expect(400);
  expect(servicio.confirmar).not.toHaveBeenCalled();
});
it('exige sesión de empresa, acceso a planificación y capacidad contratada', async () => {
  auth = undefined;
  await request(app.getHttpServer())
    .post(`${ruta}/simular`)
    .send({})
    .expect(401);
  auth = { ...baseAuth, permisos: new Set(['acceso.por_vista']) };
  await request(app.getHttpServer())
    .post(`${ruta}/simular`)
    .send({})
    .expect(403);
  auth = baseAuth;
  capacidades.exigirIncluida.mockRejectedValueOnce(
    new ForbiddenException('No incluida'),
  );
  await request(app.getHttpServer())
    .post(`${ruta}/confirmar`)
    .send({ token: 'x' })
    .expect(403);
  expect(servicio.simular).not.toHaveBeenCalled();
  expect(servicio.confirmar).not.toHaveBeenCalled();
});
