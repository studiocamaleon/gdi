import { CapacidadesEmpresaService } from '../suscripciones/capacidades-empresa.service';
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
import { PermisosGuard } from '../auth/permisos.guard';
import { Reflector } from '@nestjs/core';

const id = '11111111-1111-4111-8111-111111111111';
describe('impresión directa habilitada explícitamente por plan', () => {
  let app: INestApplication;
  let permisos = new Set<string>();
  let suscripcion: null | { estado: string; plan: { featuresJson: object } } =
    null;
  const prisma = {
    tenant: {
      findUnique: jest.fn(() => Promise.resolve({ activo: true, suscripcion })),
    },
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
  const documentos = {
    historial: jest.fn(() => ({ total: 1, envios: [] })),
    confirmar: jest.fn(() => ({ ok: true })),
  };
  beforeEach(() => {
    permisos = new Set([
      'configuracion.ver',
      'configuracion.gestionar',
      'comercial.ver',
      'comercial.gestionar',
      'produccion.ver',
      'produccion.ejecutar',
    ]);
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ImpresionController, PerfilesCadController],
      providers: [
        ImpresionDirectaGuard,
        {
          provide: CapacidadesEmpresaService,
          useValue: new CapacidadesEmpresaService(
            prisma as unknown as PrismaService,
          ),
        },
        { provide: SuscripcionesService, useValue: suscripciones },
        { provide: ImpresionService, useValue: impresion },
        { provide: DocumentosOrdenService, useValue: documentos },
        { provide: PerfilesImpresionService, useValue: {} },
        { provide: PerfilesCadService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(new PermisosGuard(module.get(Reflector)));
    app.use((req: { auth: object }, _res: unknown, next: () => void) => {
      req.auth = { tenantId: id, permisos };
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

  it('el bloqueo administrativo prevalece sobre la habilitación del plan', async () => {
    suscripcion = {
      estado: 'activa',
      plan: { featuresJson: { impresionDirecta: true } },
    };
    prisma.tenant.findUnique.mockResolvedValueOnce({
      activo: false,
      suscripcion,
    });
    await request(app.getHttpServer() as Server)
      .get('/impresion/configuracion')
      .expect(403);
  });

  it('el historial no exige impresión contratada, pero conserva permisos personales y validación de parámetros', async () => {
    suscripcion = { estado: 'activa', plan: { featuresJson: {} } };
    permisos = new Set(['comercial.ver']);
    await request(app.getHttpServer() as Server)
      .get(`/impresion/ordenes/${id}/historial-documentos?desde=50`)
      .expect(200)
      .expect('Cache-Control', 'no-store');
    expect(documentos.historial).toHaveBeenLastCalledWith(
      expect.objectContaining({ tenantId: id }),
      id,
      50,
    );
    await request(app.getHttpServer() as Server)
      .get(`/impresion/ordenes/${id}/historial-documentos?desde=abc`)
      .expect(400);
    await request(app.getHttpServer() as Server)
      .post(`/impresion/ordenes/${id}/confirmacion-documentos`)
      .send({ envioIds: [id] })
      .expect(403);
    permisos = new Set();
    await request(app.getHttpServer() as Server)
      .get(`/impresion/ordenes/${id}/historial-documentos`)
      .expect(403);
    permisos = new Set(['produccion.ejecutar']);
    await request(app.getHttpServer() as Server)
      .post(`/impresion/ordenes/${id}/confirmacion-documentos`)
      .send({ envioIds: [id] })
      .expect(201);
    expect(documentos.confirmar).toHaveBeenLastCalledWith(
      expect.objectContaining({ tenantId: id }),
      id,
      [id],
    );
    await request(app.getHttpServer() as Server)
      .post(`/impresion/ordenes/${id}/cola`)
      .expect(403);
  });
});
