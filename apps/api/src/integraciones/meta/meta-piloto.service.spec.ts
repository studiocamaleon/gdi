import { Prisma } from '@prisma/client';
import { MetaPilotoService } from './meta-piloto.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MetaCloudClient } from './meta-cloud.client';
import type { CapacidadesEmpresaService } from '../../suscripciones/capacidades-empresa.service';
const config = {
  META_WHATSAPP_PILOT_ENABLED: 'true',
  META_PILOT_TENANT_ID: '11111111-1111-4111-8111-111111111111',
  META_PILOT_PHONE_NUMBER_ID: '12345',
  META_PILOT_WABA_ID: '67890',
  META_PILOT_RECIPIENT: '+16505550123',
  META_PILOT_ACCESS_TOKEN: 'token-exclusivo-sintetico',
  META_APP_SECRET: 'app-secret',
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify',
};
const original = Object.fromEntries(
  Object.keys(config).map((k) => [k, process.env[k]]),
);
beforeEach(() => {
  Object.assign(process.env, config);
});
afterEach(() => {
  for (const k of Object.keys(config)) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
});
function setup() {
  const rows = {
    create: jest.fn().mockResolvedValue({ id: 'mensaje-1' }),
    updateMany: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  };
  const db = {
    notificacionWhatsapp: rows,
    $transaction: jest.fn((fn) => fn({ notificacionWhatsapp: rows })),
  };
  const client = {
    enviarPlantilla: jest
      .fn()
      .mockResolvedValue({ estado: 'aceptada', wamid: 'wamid.1' }),
  };
  const capacidades = { exigirOperacionTx: jest.fn() };
  return {
    rows,
    client,
    capacidades,
    service: new MetaPilotoService(
      db as unknown as PrismaService,
      client as unknown as MetaCloudClient,
      capacidades as unknown as CapacidadesEmpresaService,
    ),
  };
}
it('otra empresa y piloto apagado no pueden enviar ni consultar datos', async () => {
  const { service, client } = setup();
  expect(await service.estado('otro')).toBeNull();
  await expect(service.enviarPrueba('otro', 'clave')).rejects.toThrow();
  delete process.env.META_WHATSAPP_PILOT_ENABLED;
  await expect(
    service.enviarPrueba(config.META_PILOT_TENANT_ID, 'clave'),
  ).rejects.toThrow();
  expect(client.enviarPlantilla).not.toHaveBeenCalled();
});
it('usa sólo el destinatario configurado y no devuelve credenciales', async () => {
  const { service, client, rows } = setup();
  const result = await service.enviarPrueba(
    config.META_PILOT_TENANT_ID,
    'clave',
  );
  expect(client.enviarPlantilla.mock.calls[0][0]).toMatchObject({
    telefono: config.META_PILOT_RECIPIENT,
    plantilla: 'hello_world',
    idioma: 'en_US',
  });
  expect(JSON.stringify(result)).not.toContain(config.META_PILOT_ACCESS_TOKEN);
  expect(rows.updateMany.mock.calls[0][0].where).toMatchObject({
    tenantId: config.META_PILOT_TENANT_ID,
    estadoEntrega: null,
    estado: 'enviando',
  });
});
it('un pedido repetido no vuelve a llamar a Meta', async () => {
  const { service, client, rows } = setup();
  rows.create.mockRejectedValue(
    new Prisma.PrismaClientKnownRequestError('duplicado', {
      code: 'P2002',
      clientVersion: 'test',
    }),
  );
  await service.enviarPrueba(config.META_PILOT_TENANT_ID, 'misma-clave');
  expect(client.enviarPlantilla).not.toHaveBeenCalled();
});
it('sin capacidad contratada no crea el envío', async () => {
  const { service, capacidades, rows, client } = setup();
  capacidades.exigirOperacionTx.mockRejectedValue(new Error('no incluido'));
  await expect(
    service.enviarPrueba(config.META_PILOT_TENANT_ID, 'clave'),
  ).rejects.toThrow('no incluido');
  expect(rows.create).not.toHaveBeenCalled();
  expect(client.enviarPlantilla).not.toHaveBeenCalled();
});
it('resultado incierto no se reenvía automáticamente', async () => {
  const { service, client, rows } = setup();
  client.enviarPlantilla.mockResolvedValue({ estado: 'incierta' });
  await service.enviarPrueba(config.META_PILOT_TENANT_ID, 'clave');
  expect(rows.updateMany.mock.calls[0][0].data.estado).toBe('meta_incierta');
  expect(client.enviarPlantilla).toHaveBeenCalledTimes(1);
});
