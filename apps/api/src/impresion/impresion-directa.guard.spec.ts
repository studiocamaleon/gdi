import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'node:http';
import { ImpresionController } from './impresion.controller';
import { PerfilesCadController } from './perfiles-cad.controller';
import { ImpresionDirectaGuard } from './impresion-directa.guard';
import { ImpresionService } from './impresion.service';
import { DocumentosOrdenService } from './documentos-orden.service';
import { PerfilesImpresionService } from './perfiles-impresion.service';
import { PerfilesCadService } from './perfiles-cad.service';
import { SuscripcionesService } from '../suscripciones/suscripciones.service';
import { PrismaService } from '../prisma/prisma.service';

const id = '11111111-1111-4111-8111-111111111111';
describe('impresión directa habilitada explícitamente por plan', () => {
  let app: INestApplication;
  let suscripcion: null | { estado: string; plan: { featuresJson: object } } =
    null;
  const prisma = {
    suscripcion: { findFirst: jest.fn(() => Promise.resolve(suscripcion)) },
  };
  const suscripciones = new SuscripcionesService(
    prisma as unknown as PrismaService,
    null!,
    null!,
    null!,
  );
  const impresion = {
    configuracion: jest.fn(() => ({ firmaDisponible: true })),
    vistaPrevia: jest.fn(() => ({ numero: 'OT', paginas: ['png'] })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ImpresionController, PerfilesCadController],
      providers: [
        ImpresionDirectaGuard,
        { provide: SuscripcionesService, useValue: suscripciones },
        { provide: ImpresionService, useValue: impresion },
        { provide: DocumentosOrdenService, useValue: {} },
        { provide: PerfilesImpresionService, useValue: {} },
        { provide: PerfilesCadService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.use((req: { auth: object }, _res: unknown, next: () => void) => {
      req.auth = { tenantId: id };
      next();
    });
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it.each([null, { todo: true }, {}, { impresionDirecta: false }])(
    'no hereda impresión de legacy ni acceso total: %j',
    async (features) => {
      suscripcion = features
        ? { estado: 'activa', plan: { featuresJson: features } }
        : null;
      for (const url of [
        '/impresion/configuracion',
        '/impresion/cola',
        '/impresion/perfiles',
        `/impresion/cad/destinos/${id}/opciones`,
      ])
        await request(app.getHttpServer() as Server)
          .get(url)
          .expect(403);
      await request(app.getHttpServer() as Server)
        .post(`/impresion/ordenes/${id}/etiqueta`)
        .send({ impresora: 'HP', copias: 1 })
        .expect(403);
      await request(app.getHttpServer() as Server)
        .post(`/impresion/ordenes/${id}/cola`)
        .expect(403);
      await request(app.getHttpServer() as Server)
        .post('/impresion/impresoras')
        .expect(403);
    },
  );
  it('permite etiquetas manuales sin QZ y mantiene capacidades previas en legacy', async () => {
    suscripcion = null;
    await request(app.getHttpServer() as Server)
      .get(`/impresion/ordenes/${id}/etiqueta`)
      .expect(200);
    expect(await suscripciones.feature(id, 'centroCopiado')).toBe(true);
  });
  it('autoriza únicamente la habilitación explícita y revalida al revocarla', async () => {
    suscripcion = {
      estado: 'activa',
      plan: { featuresJson: { todo: true, impresionDirecta: true } },
    };
    await request(app.getHttpServer() as Server)
      .get('/impresion/configuracion')
      .expect(200);
    suscripcion.plan.featuresJson = { todo: true, impresionDirecta: false };
    await request(app.getHttpServer() as Server)
      .get('/impresion/configuracion')
      .expect(403);
    suscripcion.plan.featuresJson = { impresionDirecta: true };
    suscripcion.estado = 'suspendida';
    await request(app.getHttpServer() as Server)
      .get('/impresion/configuracion')
      .expect(403);
  });
});
