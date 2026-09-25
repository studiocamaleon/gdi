import { createHmac } from 'crypto';
import { WebhooksWhatsappService } from '../webhooks-whatsapp.service';
import type { PrismaService } from '../../prisma/prisma.service';
const secretAnterior = process.env.META_APP_SECRET;
const SECRET = 'app-secret-de-prueba';
beforeEach(() => {
  process.env.META_APP_SECRET = SECRET;
});
afterEach(() => {
  if (secretAnterior === undefined) delete process.env.META_APP_SECRET;
  else process.env.META_APP_SECRET = secretAnterior;
});
const firmar = (b: Buffer) =>
  'sha256=' + createHmac('sha256', SECRET).update(b).digest('hex');
function db() {
  const tx = {
    webhookWhatsappCrudo: { createMany: jest.fn(), updateMany: jest.fn() },
    notificacionWhatsapp: {
      updateMany: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
    },
  };
  const prisma = {
    ...tx,
    integracionTenant: {
      findMany: jest.fn().mockResolvedValue([{ tenantId: 'tenant-1' }]),
    },
    $transaction: jest.fn((fn) => fn(tx)),
  };
  return {
    prisma,
    tx,
    service: new WebhooksWhatsappService(prisma as unknown as PrismaService),
  };
}
function body(status = 'delivered') {
  return {
    entry: [
      {
        id: 'waba-1',
        changes: [
          {
            field: 'messages',
            value: {
              metadata: { phone_number_id: 'phone-1' },
              statuses: [{ id: 'wamid.1', status, timestamp: '1770000000' }],
            },
          },
        ],
      },
    ],
  };
}
it('autentica los bytes exactos; rechaza firmas faltantes, malformadas y cuerpos cambiados', () => {
  const { service } = db();
  const b = Buffer.from('{"entry":[]}');
  expect(service.verificarFirma(b, firmar(b))).toBe(true);
  expect(service.verificarFirma(Buffer.from('{}'), firmar(b))).toBe(false);
  expect(service.verificarFirma(b, undefined)).toBe(false);
  expect(service.verificarFirma(b, 'sha256=' + 'x'.repeat(64))).toBe(false);
  delete process.env.META_APP_SECRET;
  expect(service.verificarFirma(b, firmar(b))).toBe(false);
});
it('desarma todo el lote mixto preservando cuenta, número y cada mensaje', () => {
  const { service } = db();
  const b = body();
  Object.assign(b.entry[0].changes[0].value, {
    messages: [{ id: 'wamid.2' }, { id: 'wamid.3' }],
  });
  const parsed = service.extraerCambios(b);
  expect(parsed).toHaveLength(3);
  expect(parsed.map((c) => c.wamid)).toEqual(['wamid.1', 'wamid.2', 'wamid.3']);
  expect(parsed[0]).toMatchObject({
    tipo: 'statuses',
    wabaId: 'waba-1',
    phoneNumberId: 'phone-1',
  });
  expect(parsed[1].payload.statuses).toBeUndefined();
});
it.each([null, {}, { entry: [null, { changes: [null, { value: null }] }] }])(
  'tolera envelopes malformados sin lanzar',
  (value) => {
    expect(db().service.extraerCambios(value)).toEqual([]);
  },
);
it('deduplica el evento completo y no confunde sent con read del mismo wamid', async () => {
  const { service, tx } = db();
  await service.persistir(service.extraerCambios(body('sent')));
  await service.persistir(service.extraerCambios(body('sent')));
  await service.persistir(service.extraerCambios(body('read')));
  const calls = tx.webhookWhatsappCrudo.createMany.mock.calls;
  expect(calls[0][0].skipDuplicates).toBe(true);
  expect(calls[0][0].data[0].dedupClave).toEqual(
    calls[1][0].data[0].dedupClave,
  );
  expect(calls[0][0].data[0].dedupClave).not.toEqual(
    calls[2][0].data[0].dedupClave,
  );
  expect(
    tx.notificacionWhatsapp.updateMany.mock.calls[2][0].data.estadoEntrega,
  ).toBe('read');
});
it('asociación ambigua o desconocida se guarda sin empresa y no actualiza mensajes', async () => {
  const { service, prisma, tx } = db();
  prisma.integracionTenant.findMany.mockResolvedValue([
    { tenantId: 'a' },
    { tenantId: 'b' },
  ]);
  await service.persistir(service.extraerCambios(body()));
  expect(
    tx.webhookWhatsappCrudo.createMany.mock.calls[0][0].data[0].tenantId,
  ).toBeNull();
  expect(tx.notificacionWhatsapp.updateMany).not.toHaveBeenCalled();
});
it('un evento de plantilla sin número conserva waba_id para rutearlo', async () => {
  const { service, prisma, tx } = db();
  await service.persistir(
    service.extraerCambios({
      entry: [
        {
          id: 'waba-1',
          changes: [
            {
              field: 'message_template_status_update',
              value: { event: 'APPROVED' },
            },
          ],
        },
      ],
    }),
  );
  expect(prisma.integracionTenant.findMany.mock.calls[0][0].where.AND).toEqual([
    { metadataJson: { path: ['wabaId'], equals: 'waba-1' } },
  ]);
  expect(
    tx.webhookWhatsappCrudo.createMany.mock.calls[0][0].data[0],
  ).toMatchObject({
    tenantId: 'tenant-1',
    wabaId: 'waba-1',
    phoneNumberId: null,
  });
});
it('no confirma a Meta si la persistencia falla', async () => {
  const { service, tx } = db();
  tx.webhookWhatsappCrudo.createMany.mockRejectedValue(new Error('db caída'));
  await expect(
    service.persistir(service.extraerCambios(body())),
  ).rejects.toThrow('db caída');
});
