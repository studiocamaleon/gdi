import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppThrottlerGuard } from './app-throttler.guard';

@Controller('prueba-limite')
class PruebaLimiteController {
  @Get()
  leer() {
    return { ok: true };
  }
}

describe('Límite previo a autenticar', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 2 }]),
      ],
      controllers: [PruebaLimiteController],
      providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
    }).compile();
    app = modulo.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('rotar credenciales inventadas no reinicia el límite de la misma IP', async () => {
    const servidor = app.getHttpServer() as Server;
    await request(servidor)
      .get('/prueba-limite')
      .set('Authorization', 'Bearer grafo_mcp_ficticio1')
      .expect(200);
    await request(servidor)
      .get('/prueba-limite')
      .set('Authorization', 'Bearer grafo_mcp_ficticio2')
      .expect(200);
    await request(servidor)
      .get('/prueba-limite')
      .set('Authorization', 'Bearer grafo_mcp_ficticio3')
      .expect(429);
  });
});
