import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { PaddleService } from '../paddle.service';
import { SuscripcionSyncService } from '../suscripcion-sync.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * Lo que fija este spec:
 *  - la FIRMA del webhook: sin ella el endpoint es una puerta abierta;
 *  - la normalización de estados, sobre todo que `past_due` NO corta el acceso;
 *  - la resolución de tenant y de plan (por referencia, por custom_data, y por
 *    paddlePriceId), que es lo que hace que un upgrade se refleje solo.
 */

const SECRET = 'pdl_ntfset_test_secret';
process.env.PADDLE_API_KEY = 'pdl_sdbx_apikey_de_prueba';
process.env.PADDLE_WEBHOOK_SECRET = SECRET;
process.env.PADDLE_ENV = 'sandbox';

const prisma = new PrismaClient();
const paddle = new PaddleService();
const sync = new SuscripcionSyncService(prisma as unknown as PrismaService);

/** Arma la cabecera igual que Paddle: HMAC-SHA256 de `ts:body`. */
function firmar(body: string, ts = Math.floor(Date.now() / 1000)): string {
  const h1 = createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

function eventoSuscripcion(over: Record<string, unknown> = {}) {
  return {
    event_id: `evt_${randomUUID().slice(0, 12)}`,
    event_type: 'subscription.updated',
    occurred_at: new Date().toISOString(),
    data: {
      id: `sub_${randomUUID().slice(0, 12)}`,
      status: 'active',
      customer_id: 'ctm_prueba',
      next_billed_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      items: [{ price: { id: 'pri_prueba', product_id: 'pro_prueba' } }],
      ...over,
    },
  };
}

describe('Cobro · verificación de firma del webhook', () => {
  it('acepta un evento con firma válida', async () => {
    const body = JSON.stringify(eventoSuscripcion());
    const evento = await paddle.verificarEvento(body, firmar(body));
    expect(evento).not.toBeNull();
    expect(evento?.eventType).toBe('subscription.updated');
  });

  it('rechaza una firma inválida', async () => {
    const body = JSON.stringify(eventoSuscripcion());
    const mala = firmar(body).replace(/h1=.*/, 'h1=' + '0'.repeat(64));
    expect(await paddle.verificarEvento(body, mala)).toBeNull();
  });

  it('rechaza si el cuerpo fue alterado después de firmar', async () => {
    const original = JSON.stringify(eventoSuscripcion());
    const firma = firmar(original);
    const alterado = original.replace('"active"', '"canceled"');
    expect(await paddle.verificarEvento(alterado, firma)).toBeNull();
  });

  it('rechaza un timestamp viejo (replay)', async () => {
    const body = JSON.stringify(eventoSuscripcion());
    const viejo = Math.floor(Date.now() / 1000) - 3600;
    expect(await paddle.verificarEvento(body, firmar(body, viejo))).toBeNull();
  });

  it('un evento auténtico que el SDK no sabe mapear NO se descarta', async () => {
    // El payload es parcial (le falta billing_cycle y demás), así que la
    // deserialización tipada del SDK falla — pero la firma es válida, o sea
    // que viene de Paddle. Perder un 'subscription.canceled' por un campo
    // inesperado sería mucho peor que leerlo del JSON crudo.
    const body = JSON.stringify(eventoSuscripcion({ status: 'canceled' }));
    const evento = await paddle.verificarEvento(body, firmar(body));
    expect(evento).not.toBeNull();
    expect(evento?.eventType).toBe('subscription.updated');
    // Y el extractor lo entiende igual, aunque venga en snake_case.
    const externa = sync.extraer(evento?.data);
    expect(externa?.estadoProveedor).toBe('canceled');
    expect(externa?.precios).toEqual(['pri_prueba']);
    expect(externa?.clienteExterno).toBe('ctm_prueba');
  });
});

describe('Cobro · normalización a nuestra suscripción', () => {
  let tenantId: string;
  let planId: string;
  const priceId = `pri_${randomUUID().slice(0, 10)}`;

  beforeAll(async () => {
    const t = await prisma.tenant.create({
      data: { nombre: 'Imprenta Cobro', slug: `test-cobro-${randomUUID()}` },
      select: { id: true },
    });
    tenantId = t.id;
    const p = await prisma.plan.create({
      data: {
        codigo: `test-plan-${randomUUID().slice(0, 8)}`,
        nombre: 'Plan de prueba',
        precioMensual: 49,
        moneda: 'USD',
        featuresJson: { afip: true },
        paddlePriceId: priceId,
      },
      select: { id: true },
    });
    planId = p.id;
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
    await prisma.plan.deleteMany({ where: { id: planId } });
    await prisma.$disconnect();
  });

  it('extrae los datos del payload y descarta lo que no tiene forma', () => {
    const ok = sync.extraer({
      id: 'sub_1',
      status: 'active',
      customerId: 'ctm_1',
      items: [{ price: { id: 'pri_1' } }],
      customData: { tenantId: 'abc' },
      nextBilledAt: '2026-09-01T00:00:00Z',
    });
    expect(ok).toMatchObject({
      referencia: 'sub_1',
      estadoProveedor: 'active',
      clienteExterno: 'ctm_1',
      precios: ['pri_1'],
      tenantId: 'abc',
    });
    expect(sync.extraer(null)).toBeNull();
    expect(sync.extraer({ status: 'active' })).toBeNull();
  });

  it('da de alta la suscripción resolviendo tenant y plan', async () => {
    const r = await sync.aplicar({
      referencia: 'sub_alta',
      estadoProveedor: 'active',
      clienteExterno: 'ctm_1',
      proximoCobro: null,
      precios: [priceId],
      tenantId,
      cambioProgramado: null,
      cambioProgramadoEl: null,
    });
    expect(r).toMatchObject({ aplicado: true, estado: 'activa' });
    const s = await prisma.suscripcion.findFirst({ where: { tenantId } });
    expect(s?.proveedor).toBe('paddle');
    expect(s?.planId).toBe(planId);
    expect(s?.referenciaExterna).toBe('sub_alta');
  });

  it('past_due NO corta el acceso (hay ventana de dunning), pero se registra', async () => {
    await sync.aplicar({
      referencia: 'sub_alta',
      estadoProveedor: 'past_due',
      clienteExterno: 'ctm_1',
      proximoCobro: null,
      precios: [priceId],
      tenantId: null, // resuelve por la referencia ya vinculada
      cambioProgramado: null,
      cambioProgramadoEl: null,
    });
    const s = await prisma.suscripcion.findFirst({ where: { tenantId } });
    expect(s?.estado).toBe('activa');
    expect(s?.estadoProveedor).toBe('past_due');
  });

  it('canceled da de baja y sella la fecha', async () => {
    await sync.aplicar({
      referencia: 'sub_alta',
      estadoProveedor: 'canceled',
      clienteExterno: 'ctm_1',
      proximoCobro: null,
      precios: [priceId],
      tenantId: null,
      cambioProgramado: null,
      cambioProgramadoEl: null,
    });
    const s = await prisma.suscripcion.findFirst({ where: { tenantId } });
    expect(s?.estado).toBe('baja');
    expect(s?.hasta).toBeInstanceOf(Date);
  });

  it('no aplica si no puede resolver el tenant', async () => {
    const r = await sync.aplicar({
      referencia: 'sub_huerfana',
      estadoProveedor: 'active',
      clienteExterno: null,
      proximoCobro: null,
      precios: [priceId],
      tenantId: null,
      cambioProgramado: null,
      cambioProgramadoEl: null,
    });
    expect(r.aplicado).toBe(false);
  });

  it('no aplica ante un estado desconocido de la pasarela', async () => {
    const r = await sync.aplicar({
      referencia: 'sub_alta',
      estadoProveedor: 'algo_nuevo',
      clienteExterno: null,
      proximoCobro: null,
      precios: [priceId],
      tenantId,
      cambioProgramado: null,
      cambioProgramadoEl: null,
    });
    expect(r.aplicado).toBe(false);
  });
});
