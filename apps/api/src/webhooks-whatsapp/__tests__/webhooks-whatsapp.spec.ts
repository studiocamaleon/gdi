import { createHmac } from 'crypto';
import { WebhooksWhatsappService } from '../webhooks-whatsapp.service';
import type { PrismaService } from '../../prisma/prisma.service';

/**
 * El endpoint es @Public: la firma ES la autenticación, y el desarme del
 * envelope decide qué se persiste y cómo se rutea. Los bordes que importan
 * son los de seguridad (firma) y los de no perder datos (tipos raros,
 * envelope malformado → igual se persiste algo razonable).
 */

const SECRET = 'app-secret-de-prueba';

function servicio(prismaMock?: Partial<PrismaService>) {
  process.env.META_APP_SECRET = SECRET;
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-token-prueba';
  return new WebhooksWhatsappService((prismaMock ?? {}) as PrismaService);
}

function firmar(body: string, secret = SECRET) {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

describe('verificarFirma', () => {
  it('acepta la firma correcta sobre el body crudo', () => {
    const s = servicio();
    const body = Buffer.from('{"entry":[]}');
    expect(s.verificarFirma(body, firmar(body.toString()))).toBe(true);
  });

  it('rechaza firma con otro secret, header malformado y body alterado', () => {
    const s = servicio();
    const body = Buffer.from('{"entry":[]}');
    expect(s.verificarFirma(body, firmar(body.toString(), 'otro'))).toBe(false);
    expect(s.verificarFirma(body, 'sha1=abc')).toBe(false);
    expect(s.verificarFirma(body, undefined)).toBe(false);
    // Body cambiado después de firmar (el ataque que la firma existe para parar).
    expect(
      s.verificarFirma(Buffer.from('{"entry":[{}]}'), firmar(body.toString())),
    ).toBe(false);
  });

  it('sin META_APP_SECRET no puede verificar (y el controller corta antes)', () => {
    const s = servicio();
    delete process.env.META_APP_SECRET;
    expect(s.puedeVerificarFirma).toBe(false);
    expect(s.verificarFirma(Buffer.from('x'), firmar('x'))).toBe(false);
  });
});

describe('extraerCambios', () => {
  const meta = { phone_number_id: '1246659925201919' };

  it('statuses y messages llegan por el mismo field y se distinguen', () => {
    const s = servicio();
    const cambios = s.extraerCambios({
      entry: [
        {
          id: 'WABA1',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: meta,
                statuses: [{ id: 'wamid.STATUS1', status: 'delivered' }],
              },
            },
            {
              field: 'messages',
              value: {
                metadata: meta,
                messages: [{ id: 'wamid.MSG1', type: 'text' }],
              },
            },
          ],
        },
      ],
    });
    expect(cambios).toHaveLength(2);
    expect(cambios[0]).toMatchObject({
      tipo: 'statuses',
      wamid: 'wamid.STATUS1',
      phoneNumberId: meta.phone_number_id,
    });
    expect(cambios[1]).toMatchObject({ tipo: 'messages', wamid: 'wamid.MSG1' });
  });

  it('history/echoes/template_update conservan su field como tipo', () => {
    const s = servicio();
    const cambios = s.extraerCambios({
      entry: [
        {
          changes: [
            { field: 'history', value: { metadata: meta, phase: 1 } },
            { field: 'smb_message_echoes', value: { metadata: meta } },
            {
              field: 'message_template_status_update',
              value: { event: 'APPROVED', message_template_name: 'pedido_listo' },
            },
          ],
        },
      ],
    });
    expect(cambios.map((c) => c.tipo)).toEqual([
      'history',
      'smb_message_echoes',
      'message_template_status_update',
    ]);
    // Los de gestión no traen metadata de número: quedan sin phoneNumberId.
    expect(cambios[2].phoneNumberId).toBeNull();
  });

  it('envelope malformado no explota y devuelve vacío', () => {
    const s = servicio();
    expect(s.extraerCambios(null)).toEqual([]);
    expect(s.extraerCambios({})).toEqual([]);
    expect(s.extraerCambios({ entry: 'no-array' })).toEqual([]);
    expect(s.extraerCambios({ entry: [{ changes: null }] })).toEqual([]);
  });
});

describe('persistir', () => {
  it('rutea por phone_number_id contra IntegracionTenant y cachea el lookup', async () => {
    const findFirst = jest.fn().mockResolvedValue({ tenantId: 'tenant-1' });
    const createMany = jest.fn().mockResolvedValue({ count: 2 });
    const s = servicio({
      integracionTenant: { findFirst },
      webhookWhatsappCrudo: { createMany },
    } as unknown as Partial<PrismaService>);

    await s.persistir([
      { tipo: 'statuses', wamid: 'w1', phoneNumberId: 'PNI-1', payload: {} },
      { tipo: 'messages', wamid: 'w2', phoneNumberId: 'PNI-1', payload: {} },
    ]);

    // Mismo número → UNA sola query de ruteo para los dos cambios.
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ tenantId: 'tenant-1', tipo: 'statuses' }),
        expect.objectContaining({ tenantId: 'tenant-1', tipo: 'messages' }),
      ],
    });
  });

  it('sin integración conectada persiste igual con tenantId null (nunca descarta)', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const s = servicio({
      integracionTenant: { findFirst },
      webhookWhatsappCrudo: { createMany },
    } as unknown as Partial<PrismaService>);

    await s.persistir([
      { tipo: 'messages', wamid: 'w1', phoneNumberId: 'PNI-X', payload: {} },
    ]);

    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ tenantId: null })],
    });
  });
});
