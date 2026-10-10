import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Readable } from 'node:stream';
import { unzipSync } from 'fflate';
import { ArchivosController } from '../archivos.controller';
import { ArchivosService } from '../archivos.service';
import { PrismaService } from '../../prisma/prisma.service';

const id = '77777777-7777-4777-8777-777777777777';
const prisma = {
  ordenTrabajo: {
    findFirst: jest.fn(({ where }) =>
      Promise.resolve(
        where.tenantId === 'empresa-a' && where.id === id
          ? { numero: 'OT-DEMO', items: [{ id }] }
          : null,
      ),
    ),
  },
  ordenTrabajoItem: {
    findFirst: jest.fn(({ where }) =>
      Promise.resolve(
        where.tenantId === 'empresa-a' && where.id === id
          ? { id, ordenId: id, nombre: 'Trabajo ficticio' }
          : null,
      ),
    ),
  },
  archivo: {
    findMany: jest.fn(() =>
      Promise.resolve([
        {
          key: 'privado',
          nombreOriginal: 'Arte.pdf',
          bytes: 4n,
          ordenItemId: id,
        },
      ]),
    ),
  },
};
let app: INestApplication;
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [ArchivosController],
    providers: [
      { provide: PrismaService, useValue: prisma },
      {
        provide: ArchivosService,
        useValue: new ArchivosService(
          prisma as never,
          {
            abrirLectura: async () => Readable.from([Buffer.from('%PDF')]),
          } as never,
          {} as never,
        ),
      },
    ],
  }).compile();
  app = module.createNestApplication();
  // Identidades ficticias para probar el guard real; no usa JWT ni servicios externos.
  app.use((req: any, _res: any, next: () => void) => {
    if (req.headers['x-qa-permiso'])
      req.auth = {
        tenantId: req.headers['x-qa-empresa'] || 'empresa-a',
        permisos: new Set([req.headers['x-qa-permiso']]),
      };
    next();
  });
  await app.init();
});
afterAll(async () => app.close());

it.each(['orden', 'item'])(
  'sirve ZIP privado para %s con permiso comercial o de taller',
  async (tipo) => {
    for (const permiso of ['comercial.ordenes.ver', 'produccion.tablero.ver']) {
      const r = await request(app.getHttpServer())
        .get(`/archivos/de-${tipo}/${id}/zip`)
        .set('x-qa-permiso', permiso)
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .expect(200);
      expect(r.headers['cache-control']).toBe('private, no-store');
      expect(r.headers['content-disposition']).toContain('attachment;');
      expect(Buffer.from(Object.values(unzipSync(r.body))[0]).toString()).toBe(
        '%PDF',
      );
    }
  },
);
it.each(['orden', 'item'])(
  'rechaza acceso sin sesión, sin permiso o de otra empresa para %s',
  async (tipo) => {
    const ruta = `/archivos/de-${tipo}/${id}/zip`;
    await request(app.getHttpServer()).get(ruta).expect(401);
    await request(app.getHttpServer())
      .get(ruta)
      .set('x-qa-permiso', 'inventario.ver')
      .expect(403);
    await request(app.getHttpServer())
      .get(ruta)
      .set('x-qa-permiso', 'comercial.ordenes.ver')
      .set('x-qa-empresa', 'empresa-b')
      .expect(404);
  },
);
it('comprobar no descarga bytes y UUID inválido se rechaza antes de consultar datos', async () => {
  await request(app.getHttpServer())
    .get(`/archivos/de-orden/${id}/zip?comprobar=1`)
    .set('x-qa-permiso', 'comercial.ordenes.ver')
    .expect(200, { cantidad: 1 });
  await request(app.getHttpServer())
    .get('/archivos/de-orden/no-id/zip')
    .set('x-qa-permiso', 'comercial.ordenes.ver')
    .expect(400);
});
