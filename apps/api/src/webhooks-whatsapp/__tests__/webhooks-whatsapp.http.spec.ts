import { Test } from '@nestjs/testing';
import { json } from 'express';
import request from 'supertest';
import { createHmac } from 'crypto';
import type { INestApplication } from '@nestjs/common';
import { WebhooksWhatsappController } from '../webhooks-whatsapp.controller';
import { WebhooksWhatsappService } from '../webhooks-whatsapp.service';
import { PrismaService } from '../../prisma/prisma.service';
import { configurarEntradaStaging } from '../../common/staging-ingress';
import { rutaLog } from '../../common/ruta-log';
const names = [
  'STAGING_PRIVATE',
  'STAGING_WEB_API_TOKEN',
  'STAGING_META_WEBHOOK_ENABLED',
  'META_APP_SECRET',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
];
const original = Object.fromEntries(names.map((k) => [k, process.env[k]]));
let app: INestApplication;
const tx = {
  webhookWhatsappCrudo: {
    createMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
};
beforeAll(async () => {
  Object.assign(process.env, {
    STAGING_PRIVATE: 'true',
    STAGING_WEB_API_TOKEN: 'clave-interna-sintetica-12345678901',
    STAGING_META_WEBHOOK_ENABLED: 'true',
    META_APP_SECRET: 'app-secret-sintetico',
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-sintetico',
  });
  const module = await Test.createTestingModule({
    controllers: [WebhooksWhatsappController],
    providers: [
      WebhooksWhatsappService,
      {
        provide: PrismaService,
        useValue: {
          integracionTenant: { findMany: jest.fn().mockResolvedValue([]) },
          $transaction: (fn: (db: unknown) => unknown) => fn(tx),
        },
      },
    ],
  }).compile();
  app = module.createNestApplication({ bodyParser: false });
  app.setGlobalPrefix('api');
  configurarEntradaStaging(app.getHttpAdapter().getInstance());
  app.use(
    json({
      limit: '3mb',
      verify: (req, _res, buf) => {
        (req as typeof req & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  await app.init();
});
afterAll(async () => {
  await app?.close();
  for (const k of names) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});
it('verifica challenge crudo y rechaza token incorrecto', async () => {
  const r = await request(app.getHttpServer())
    .get('/api/webhooks/whatsapp')
    .query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify-sintetico',
      'hub.challenge': '12345',
    })
    .expect(200);
  expect(r.text).toBe('12345');
  await request(app.getHttpServer())
    .get('/api/webhooks/whatsapp')
    .query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'incorrecto',
      'hub.challenge': '12345',
    })
    .expect(403);
});
it('la excepción de staging no permite POST sin firma ni abre otras rutas o métodos', async () => {
  await request(app.getHttpServer())
    .post('/api/webhooks/whatsapp')
    .send({ entry: [] })
    .expect(401);
  for (const path of [
    '/api/auth/login',
    '/api/webhooks/paddle',
    '/api/webhooks/whatsapp/extra',
    '/api/webhooks/whatsapp/',
  ])
    await request(app.getHttpServer()).post(path).send({}).expect(403);
  await request(app.getHttpServer()).head('/api/webhooks/whatsapp').expect(403);
  await request(app.getHttpServer()).put('/api/webhooks/whatsapp').expect(403);
});
it('acepta JSON firmado de más de 1 MB y falla si cambia un byte', async () => {
  const raw = JSON.stringify({
    entry: [
      {
        id: 'cuenta',
        changes: [{ field: 'history', value: { data: 'x'.repeat(1_100_000) } }],
      },
    ],
  });
  const signature =
    'sha256=' +
    createHmac('sha256', process.env.META_APP_SECRET!)
      .update(raw)
      .digest('hex');
  await request(app.getHttpServer())
    .post('/api/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .set('x-hub-signature-256', signature)
    .send(raw)
    .expect(200);
  await request(app.getHttpServer())
    .post('/api/webhooks/whatsapp')
    .set('Content-Type', 'application/json')
    .set('x-hub-signature-256', signature)
    .send(raw + ' ')
    .expect(401);
});
it('la query de verificación nunca forma parte de la ruta del log', () => {
  expect(
    rutaLog(
      '/api/webhooks/whatsapp?hub.verify_token=privado&hub.challenge=123',
    ),
  ).toBe('/api/webhooks/whatsapp');
});
