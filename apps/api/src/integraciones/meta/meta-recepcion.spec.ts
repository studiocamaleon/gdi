import { proyectarMensajePiloto } from './meta-recepcion';
import { MetaRecepcionService } from './meta-recepcion.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
import { WebhooksWhatsappService } from '../../webhooks-whatsapp/webhooks-whatsapp.service';

const config = {
  META_WHATSAPP_PILOT_ENABLED: 'true',
  META_WHATSAPP_RECEPCION_PILOT_ENABLED: 'true',
  META_PILOT_TENANT_ID: '11111111-1111-4111-8111-111111111111',
  META_PILOT_PHONE_NUMBER_ID: '12345',
  META_PILOT_WABA_ID: '67890',
  META_PILOT_RECIPIENT: '+16505550123',
  META_PILOT_ACCESS_TOKEN: 'token-exclusivo-sintetico',
  META_APP_SECRET: 'app-secret-sintetico',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-sintetico',
};
const original = Object.fromEntries(
  Object.keys(config).map((k) => [k, process.env[k]]),
);
beforeEach(() => Object.assign(process.env, config));
afterEach(() => {
  for (const k of Object.keys(config)) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});
function cambio() {
  return {
    tenantId: config.META_PILOT_TENANT_ID,
    wabaId: config.META_PILOT_WABA_ID,
    phoneNumberId: config.META_PILOT_PHONE_NUMBER_ID,
    tipo: 'messages',
    wamid: 'wamid.entrada-1',
    payload: {
      messages: [
        {
          from: '16505550123',
          id: 'wamid.entrada-1',
          timestamp: '1780000000',
          type: 'text',
          text: { body: 'Hola\n¡Grafo! 👋' },
        },
      ],
      contacts: [
        { wa_id: '16505550199', profile: { name: 'Contacto ajeno' } },
        { wa_id: '16505550123', profile: { name: 'Contacto de prueba' } },
      ],
    },
  };
}
it('conserva texto Unicode y asigna sólo el nombre del remitente correcto', () => {
  expect(proyectarMensajePiloto(cambio())).toMatchObject({
    texto: 'Hola\n¡Grafo! 👋',
    nombreContacto: 'Contacto de prueba',
    remitente: '+16505550123',
    enviadoEl: new Date(1780000000000),
  });
});
it.each(['tenantId', 'wabaId', 'phoneNumberId', 'wamid'] as const)(
  'rechaza asociación incorrecta por %s',
  (campo) => {
    const dato = cambio();
    dato[campo] = 'ajeno';
    expect(proyectarMensajePiloto(dato)).toBeNull();
  },
);
it('rechaza otro contacto y no normaliza prefijos para hacerlo coincidir', () => {
  for (const from of ['16505550199', '+16505550123', '016505550123', '']) {
    const dato = cambio();
    dato.payload.messages[0].from = from;
    expect(proyectarMensajePiloto(dato)).toBeNull();
  }
});
it.each(['history', 'smb_message_echoes', 'smb_app_state_sync', 'statuses'])(
  '%s no se presenta como un mensaje entrante nuevo',
  (tipo) => {
    expect(proyectarMensajePiloto({ ...cambio(), tipo })).toBeNull();
  },
);
it.each(['0', '-2', 'NaN', '1.2', '999999999999', ''])(
  'rechaza fecha imposible o futura: %s',
  (timestamp) => {
    const dato = cambio();
    dato.payload.messages[0].timestamp = timestamp;
    expect(proyectarMensajePiloto(dato)).toBeNull();
  },
);
it('no admite texto excesivo y tolera campos opcionales ausentes', () => {
  const dato = cambio();
  dato.payload.contacts = [];
  expect(proyectarMensajePiloto(dato)?.nombreContacto).toBeNull();
  dato.payload.messages[0].text.body = 'x'.repeat(4097);
  expect(proyectarMensajePiloto(dato)).toBeNull();
});
it('no copia referencias ni direcciones de descarga de un adjunto', () => {
  const dato = cambio();
  Object.assign(dato.payload.messages[0], {
    type: 'image',
    image: { id: 'media-id', url: 'https://example.invalid/private' },
  });
  const mensaje = proyectarMensajePiloto(dato);
  expect(mensaje).toMatchObject({ tipo: 'image', texto: null });
  expect(JSON.stringify(mensaje)).not.toContain('example.invalid');
});
it('está apagado por defecto sin impedir la conservación del webhook crudo', () => {
  delete process.env.META_WHATSAPP_RECEPCION_PILOT_ENABLED;
  expect(proyectarMensajePiloto(cambio())).toBeNull();
});

function lectura() {
  const mensajes = { findMany: jest.fn().mockResolvedValue([]) };
  const capacidades = { exigirIncluida: jest.fn() };
  const service = new MetaRecepcionService(
    { mensajeWhatsappRecibido: mensajes } as unknown as PrismaService,
    capacidades as unknown as CapacidadesEmpresaService,
  );
  return { mensajes, capacidades, service };
}
it('la lectura filtra empresa, cuenta, número y contacto; no devuelve crudos ni secretos', async () => {
  const { service, mensajes, capacidades } = lectura();
  const resultado = await service.listar(config.META_PILOT_TENANT_ID);
  expect(capacidades.exigirIncluida).toHaveBeenCalledWith(
    config.META_PILOT_TENANT_ID,
    'whatsapp_automatico',
  );
  expect(mensajes.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        tenantId: config.META_PILOT_TENANT_ID,
        wabaId: config.META_PILOT_WABA_ID,
        phoneNumberId: config.META_PILOT_PHONE_NUMBER_ID,
        remitente: config.META_PILOT_RECIPIENT,
      },
      take: 50,
    }),
  );
  const select = mensajes.findMany.mock.calls[0][0].select;
  expect(select.payload).toBeUndefined();
  expect(select.wamid).toBeUndefined();
  expect(JSON.stringify(resultado)).not.toContain(
    config.META_PILOT_ACCESS_TOKEN,
  );
});
it('otra empresa o interruptor apagado ni siquiera consultan la bandeja', async () => {
  const { service, mensajes } = lectura();
  expect(await service.listar('otra-empresa')).toBeNull();
  delete process.env.META_WHATSAPP_RECEPCION_PILOT_ENABLED;
  expect(await service.listar(config.META_PILOT_TENANT_ID)).toBeNull();
  expect(mensajes.findMany).not.toHaveBeenCalled();
});
it('un plan sin capacidad impide leer los mensajes', async () => {
  const { service, capacidades, mensajes } = lectura();
  capacidades.exigirIncluida.mockRejectedValue(new Error('plan sin capacidad'));
  await expect(service.listar(config.META_PILOT_TENANT_ID)).rejects.toThrow(
    'plan sin capacidad',
  );
  expect(mensajes.findMany).not.toHaveBeenCalled();
});
it('un error de proyección hace fallar el lote completo para que Meta reintente', async () => {
  const tx = {
    webhookWhatsappCrudo: { createMany: jest.fn(), updateMany: jest.fn() },
    mensajeWhatsappRecibido: {
      createMany: jest.fn().mockRejectedValue(new Error('base no disponible')),
    },
  };
  const service = new WebhooksWhatsappService({
    integracionTenant: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: (fn: (db: unknown) => unknown) => fn(tx),
  } as unknown as PrismaService);
  await expect(service.persistir([cambio()])).rejects.toThrow(
    'base no disponible',
  );
  expect(tx.webhookWhatsappCrudo.updateMany).not.toHaveBeenCalled();
});
