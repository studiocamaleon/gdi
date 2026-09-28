import { MetaCloudClient } from './meta-cloud.client';
const originalFetch = global.fetch;
const originalSecret = process.env.META_APP_SECRET;
const args = {
  accessToken: 'token-sintetico',
  phoneNumberId: '123456',
  telefono: '+16505550123',
  plantilla: 'hello_world',
  idioma: 'en_US',
  parametros: [],
  correlacion: 'prueba-1',
};
beforeEach(() => {
  process.env.META_APP_SECRET = 'secret-sintetico';
});
afterEach(() => {
  global.fetch = originalFetch;
  if (originalSecret === undefined) delete process.env.META_APP_SECRET;
  else process.env.META_APP_SECRET = originalSecret;
});
it('envía a Graph con token en cabecera, versión fija y correlación sin redirects', async () => {
  const mock = jest.fn().mockResolvedValue(
    new Response(JSON.stringify({ messages: [{ id: 'wamid.123' }] }), {
      status: 200,
    }),
  );
  global.fetch = mock;
  expect(await new MetaCloudClient().enviarPlantilla(args)).toEqual({
    estado: 'aceptada',
    wamid: 'wamid.123',
  });
  const [url, init] = mock.mock.calls[0];
  expect(url.origin).toBe('https://graph.facebook.com');
  expect(url.pathname).toBe('/v26.0/123456/messages');
  expect(url.href).not.toContain(args.accessToken);
  expect(init.redirect).toBe('error');
  expect(JSON.parse(init.body)).toMatchObject({
    to: args.telefono,
    biz_opaque_callback_data: 'prueba-1',
    template: { name: 'hello_world', language: { code: 'en_US' } },
  });
});
it.each([500, 502, 200])(
  'respuesta %s sin comprobante válido queda incierta y no se reintenta',
  async (status) => {
    const mock = jest
      .fn()
      .mockResolvedValue(new Response('respuesta inválida', { status }));
    global.fetch = mock;
    expect(await new MetaCloudClient().enviarPlantilla(args)).toEqual({
      estado: 'incierta',
    });
    expect(mock).toHaveBeenCalledTimes(1);
  },
);
it('timeout no reenvía ni expone los detalles del error', async () => {
  const mock = jest.fn().mockRejectedValue(new Error('URL con un secreto'));
  global.fetch = mock;
  expect(await new MetaCloudClient().enviarPlantilla(args)).toEqual({
    estado: 'incierta',
  });
  expect(mock).toHaveBeenCalledTimes(1);
});
it('un rechazo explícito conserva sólo el código', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 190, message: 'token secreto' } }),
        { status: 400 },
      ),
    );
  expect(await new MetaCloudClient().enviarPlantilla(args)).toEqual({
    estado: 'fallida',
    codigo: '190',
  });
});
it('rechaza IDs/rutas o destinatarios inválidos antes de usar la red', async () => {
  const mock = jest.fn();
  global.fetch = mock;
  await expect(
    new MetaCloudClient().enviarPlantilla({
      ...args,
      phoneNumberId: '../evil',
    }),
  ).rejects.toThrow();
  await expect(
    new MetaCloudClient().enviarPlantilla({ ...args, telefono: '6505550123' }),
  ).rejects.toThrow();
  expect(mock).not.toHaveBeenCalled();
});
