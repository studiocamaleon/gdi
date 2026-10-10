import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { ArchivosLocalController } from '../archivos-local.controller';
import { LocalDriver } from './local.driver';
import { R2Driver } from './r2.driver';
import { STORAGE_DRIVER } from './storage.driver';

describe('Una URL de subida no permite reemplazar un objeto', () => {
  const local = new LocalDriver();
  const claves: string[] = [];
  let app: INestApplication<Server>;
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [ArchivosLocalController],
      providers: [
        { provide: LocalDriver, useValue: local },
        { provide: STORAGE_DRIVER, useValue: local },
      ],
    }).compile();
    app = modulo.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    await Promise.all(claves.map((key) => local.borrar(key)));
  });
  const nuevaClave = () => {
    const key = `qa-inmutable-${randomUUID()}.pdf`;
    claves.push(key);
    return key;
  };

  it('rechaza reutilizar el mismo enlace y conserva los bytes originales', async () => {
    const key = nuevaClave();
    const firma = await local.firmarSubida(key, {
      contentType: 'application/pdf',
    });
    const url = new URL(firma.url);
    const ruta = url.pathname + url.search;
    await request(app.getHttpServer())
      .put(ruta)
      .set(firma.headers)
      .send('%PDF-original')
      .expect(200);
    await request(app.getHttpServer())
      .put(ruta)
      .set(firma.headers)
      .send('otro contenido')
      .expect(412);
    expect(await local.leer(key)).toEqual(Buffer.from('%PDF-original'));
  });

  it('sólo una de dos subidas simultáneas puede crear el objeto', async () => {
    const key = nuevaClave();
    const firma = await local.firmarSubida(key, {
      contentType: 'application/pdf',
    });
    const url = new URL(firma.url);
    const respuestas = await Promise.all(
      ['%PDF-uno', '%PDF-dos'].map((texto) =>
        request(app.getHttpServer())
          .put(url.pathname + url.search)
          .set(firma.headers)
          .send(texto),
      ),
    );
    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 412]);
    expect(['%PDF-uno', '%PDF-dos']).toContain(
      (await local.leer(key))?.toString(),
    );
  });

  it('no permite quitar la condición de creación de la firma local', async () => {
    const key = nuevaClave();
    const firma = await local.firmarSubida(key, {
      contentType: 'application/pdf',
    });
    const url = new URL(firma.url);
    url.searchParams.delete('sc');
    await request(app.getHttpServer())
      .put(url.pathname + url.search)
      .set(firma.headers)
      .send('%PDF-alterado')
      .expect(403);
    expect(await local.leer(key)).toBeNull();
  });

  it('no permite reconstruir un multipart encima del objeto completado', async () => {
    const key = nuevaClave();
    claves.push(`${key}.parte1`);
    await local.escribir(`${key}.parte1`, Buffer.from('%PDF-original'));
    await local.completarMultipart(key, 'ficticio', [{ numero: 1, etag: 'a' }]);
    await local.escribir(`${key}.parte1`, Buffer.from('reemplazo'));
    await expect(
      local.completarMultipart(key, 'ficticio', [{ numero: 1, etag: 'b' }]),
    ).rejects.toThrow();
    expect(await local.leer(key)).toEqual(Buffer.from('%PDF-original'));
  });

  it('firma la condición de creación también para R2, sin conectarse al proveedor', async () => {
    const anterior = { ...process.env };
    try {
      process.env.R2_BUCKET = 'bucket-ficticio';
      process.env.R2_ENDPOINT = 'http://localhost:1';
      process.env.R2_ACCESS_KEY_ID = 'acceso-ficticio';
      process.env.R2_SECRET_ACCESS_KEY = 'secreto-ficticio';
      const driver = new R2Driver();
      const firma = await driver.firmarSubida('empresa/archivo.pdf', {
        contentType: 'application/pdf',
      });
      expect(firma.headers['If-None-Match']).toBe('*');
      expect(
        new URL(firma.url).searchParams.get('X-Amz-SignedHeaders')?.split(';'),
      ).toContain('if-none-match');
    } finally {
      process.env = anterior;
    }
  });
});
