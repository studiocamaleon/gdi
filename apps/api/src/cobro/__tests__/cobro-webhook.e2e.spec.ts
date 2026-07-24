import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { INestApplication } from '@nestjs/common';
import { json } from 'express';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';
import { CobroWebhookController } from '../cobro-webhook.controller';
import { PaddleService } from '../paddle.service';
import { SuscripcionSyncService } from '../suscripcion-sync.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * E2E del webhook sobre HTTP real. Existe por una razón puntual que los unit
 * tests NO cubren: la firma se calcula sobre el body CRUDO, y el body lo
 * parsea un middleware global. Si la captura de `rawBody` de main.ts se rompe,
 * todos los eventos de Paddle empiezan a rebotar como "firma inválida" — este
 * test es el que avisa. Por eso replica la misma config de body parser.
 */

const SECRET = 'pdl_ntfset_e2e_secret';
process.env.PADDLE_API_KEY = 'pdl_sdbx_apikey_de_prueba';
process.env.PADDLE_WEBHOOK_SECRET = SECRET;
process.env.PADDLE_ENV = 'sandbox';

const prisma = new PrismaClient();

function firmar(body: string, ts = Math.floor(Date.now() / 1000)): string {
  const h1 = createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

describe('POST /webhooks/paddle (HTTP real)', () => {
  let app: INestApplication;
  let tenantId: string;
  let planId: string;
  const priceId = `pri_${randomUUID().slice(0, 10)}`;
  const subId = `sub_${randomUUID().slice(0, 10)}`;
  const eventoIds: string[] = [];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        PrismaModule,
        ThrottlerModule.forRoot([{ limit: 1000, ttl: 60_000 }]),
      ],
      controllers: [CobroWebhookController],
      providers: [PaddleService, SuscripcionSyncService],
    })
      .overrideProvider(APP_GUARD)
      .useValue({ canActivate: () => true })
      .compile();

    app = mod.createNestApplication();
    // MISMA configuración que main.ts: si esto cambia allá y no acá, el test
    // deja de representar la realidad.
    app.use(
      json({
        verify: (
          req: { url?: string; rawBody?: Buffer },
          _res,
          buf: Buffer,
        ) => {
          if (req.url?.startsWith('/webhooks/')) req.rawBody = buf;
        },
      }),
    );
    await app.init();

    const t = await prisma.tenant.create({
      data: { nombre: 'Imprenta E2E', slug: `test-cobro-e2e-${randomUUID()}` },
      select: { id: true },
    });
    tenantId = t.id;
    const p = await prisma.plan.create({
      data: {
        codigo: `test-plan-e2e-${randomUUID().slice(0, 8)}`,
        nombre: 'Plan E2E',
        precioMensual: 99,
        featuresJson: { afip: true },
        paddlePriceId: priceId,
      },
      select: { id: true },
    });
    planId = p.id;
  });

  afterAll(async () => {
    await prisma.eventoCobro.deleteMany({
      where: { eventoId: { in: eventoIds } },
    });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.plan.deleteMany({ where: { id: planId } });
    await app.close();
    await prisma.$disconnect();
  });

  function cuerpo(status: string, eventId: string) {
    eventoIds.push(eventId);
    return JSON.stringify({
      event_id: eventId,
      event_type: 'subscription.updated',
      occurred_at: new Date().toISOString(),
      data: {
        id: subId,
        status,
        customer_id: 'ctm_e2e',
        next_billed_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        items: [{ price: { id: priceId } }],
        custom_data: { tenantId },
      },
    });
  }

  it('rechaza sin firma', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/paddle')
      .set('content-type', 'application/json')
      .send(cuerpo('active', `evt_nofirma_${randomUUID().slice(0, 8)}`))
      .expect(401);
  });

  it('rechaza una firma que no corresponde al cuerpo', async () => {
    const body = cuerpo('active', `evt_mala_${randomUUID().slice(0, 8)}`);
    await request(app.getHttpServer())
      .post('/webhooks/paddle')
      .set('content-type', 'application/json')
      .set('paddle-signature', firmar('{"otra":"cosa"}'))
      .send(body)
      .expect(401);
  });

  it('acepta el evento firmado y sincroniza la suscripción', async () => {
    const body = cuerpo('active', `evt_ok_${randomUUID().slice(0, 8)}`);
    const res = await request(app.getHttpServer())
      .post('/webhooks/paddle')
      .set('content-type', 'application/json')
      .set('paddle-signature', firmar(body))
      .send(body)
      .expect(200);
    expect(res.body).toMatchObject({ ok: true, tenantId, estado: 'activa' });

    const s = await prisma.suscripcion.findFirst({ where: { tenantId } });
    expect(s?.proveedor).toBe('paddle');
    expect(s?.referenciaExterna).toBe(subId);
    expect(s?.planId).toBe(planId);
  });

  it('el reintento del MISMO evento no se reprocesa (idempotencia)', async () => {
    const eventId = `evt_idem_${randomUUID().slice(0, 8)}`;
    const body = cuerpo('past_due', eventId);
    const firma = firmar(body);

    const primera = await request(app.getHttpServer())
      .post('/webhooks/paddle')
      .set('content-type', 'application/json')
      .set('paddle-signature', firma)
      .send(body)
      .expect(200);
    expect((primera.body as { repetido?: boolean }).repetido).toBeUndefined();

    const segunda = await request(app.getHttpServer())
      .post('/webhooks/paddle')
      .set('content-type', 'application/json')
      .set('paddle-signature', firma)
      .send(body)
      .expect(200);
    expect(segunda.body).toMatchObject({ ok: true, repetido: true });

    // Se guardó una sola vez.
    expect(
      await prisma.eventoCobro.count({ where: { eventoId: eventId } }),
    ).toBe(1);
    // Y past_due dejó al tenant con acceso.
    const s = await prisma.suscripcion.findFirst({ where: { tenantId } });
    expect(s?.estado).toBe('activa');
    expect(s?.estadoProveedor).toBe('past_due');
  });
});
