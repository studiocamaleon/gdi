import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { IncidentesController } from '../incidentes.controller';
import { IncidentesService } from '../incidentes.service';
import { PlataformaGuard } from '../plataforma.guard';
import { PlataformaAdminGuard } from '../plataforma-admin.guard';
import { PrismaService } from '../../prisma/prisma.service';

describe('HTTP de incidentes: acceso reservado a Plataforma con MFA', () => {
  let app: INestApplication;
  const listar = jest
    .fn()
    .mockResolvedValue({ conexion: 'conectado', incidentes: [] });
  const probar = jest.fn().mockResolvedValue({ mensaje: 'Prueba ficticia' });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [IncidentesController],
      providers: [
        PlataformaGuard,
        PlataformaAdminGuard,
        { provide: IncidentesService, useValue: { listar, probar } },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: ({ where }: { where: { id: string } }) =>
                Promise.resolve({
                  activo: where.id !== 'inactivo',
                  rolPlataforma:
                    where.id === 'tenant'
                      ? null
                      : where.id === 'soporte'
                        ? 'SOPORTE'
                        : 'ADMIN',
                }),
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    // Identidades sintéticas: no se consulta una base ni se crean accesos reales.
    app.use(
      (
        req: { headers: Record<string, string>; auth?: unknown },
        _res: unknown,
        next: () => void,
      ) => {
        const id = req.headers['x-ensayo'];
        if (id)
          req.auth = {
            userId: id,
            esPlataforma: id !== 'sesion-empresa',
            plataformaMfaPendiente: id === 'sin-mfa',
            ...(id === 'delegado' ? { impersonacion: {} } : {}),
          };
        next();
      },
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
  afterAll(async () => {
    await app.close();
  });
  it('rechaza anónimos', async () => {
    await request(app.getHttpServer() as Server)
      .get('/plataforma/incidentes')
      .expect(401);
  });
  it.each(['tenant', 'sin-mfa', 'inactivo', 'sesion-empresa', 'delegado'])(
    'rechaza %s',
    async (id) => {
      await request(app.getHttpServer() as Server)
        .get('/plataforma/incidentes')
        .set('x-ensayo', id)
        .expect(403);
    },
  );
  it('permite leer a soporte y admin, sin permitir pruebas a soporte', async () => {
    await request(app.getHttpServer() as Server)
      .get('/plataforma/incidentes?entorno=staging')
      .set('x-ensayo', 'soporte')
      .expect(200);
    await request(app.getHttpServer() as Server)
      .post('/plataforma/incidentes/prueba')
      .set('x-ensayo', 'soporte')
      .expect(403);
    await request(app.getHttpServer() as Server)
      .post('/plataforma/incidentes/prueba')
      .set('x-ensayo', 'admin')
      .expect(201);
    expect(probar).toHaveBeenCalledTimes(1);
  });
  it('valida la consulta y no permite inyectar un destino o un filtro de Sentry', async () => {
    await request(app.getHttpServer() as Server)
      .get('/plataforma/incidentes?entorno=externo&url=https://otro.invalid')
      .set('x-ensayo', 'admin')
      .expect(400);
  });
});
