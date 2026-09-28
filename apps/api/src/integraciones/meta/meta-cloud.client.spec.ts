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
it('texto libre preserva saltos y caracteres, con vista previa desactivada y correlación', async () => {
  const mock = jest.fn().mockResolvedValue(
    new Response(JSON.stringify({ messages: [{ id: 'wamid.texto' }] }), {
      status: 200,
    }),
  );
  global.fetch = mock;
  const texto = '¡Hola!\nTu pedido está listo 🖨️';
  expect(await new MetaCloudClient().enviarTexto({ ...args, texto })).toEqual({
    estado: 'aceptada',
    wamid: 'wamid.texto',
  });
  const payload = JSON.parse(mock.mock.calls[0][1].body);
  expect(payload).toEqual({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: args.telefono,
    type: 'text',
    biz_opaque_callback_data: args.correlacion,
    text: { body: texto, preview_url: false },
  });
  expect(mock).toHaveBeenCalledTimes(1);
});
it('texto admite el límite y rechaza vacío o exceso antes de usar la red', async () => {
  const mock = jest.fn().mockResolvedValue(
    new Response(JSON.stringify({ messages: [{ id: 'wamid.limite' }] }), {
      status: 200,
    }),
  );
  global.fetch = mock;
  await expect(
    new MetaCloudClient().enviarTexto({ ...args, texto: 'a'.repeat(4096) }),
  ).resolves.toMatchObject({ estado: 'aceptada' });
  for (const texto of [' \n ', 'a'.repeat(4097)])
    await expect(
      new MetaCloudClient().enviarTexto({ ...args, texto }),
    ).rejects.toThrow('Texto inválido');
  expect(mock).toHaveBeenCalledTimes(1);
});
it('texto no repite un POST que agota el tiempo de espera', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
  await expect(
    new MetaCloudClient().enviarTexto({ ...args, texto: 'Hola' }),
  ).resolves.toEqual({ estado: 'incierta' });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
it('consulta la WABA actual sin seguir paging.next ni exponer el token en URL', async () => {
  const mock = jest.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        data: [],
        paging: {
          next: 'https://externo.example.invalid',
          cursors: { after: 'cursor-2' },
        },
      }),
    ),
  );
  global.fetch = mock;
  expect(
    await new MetaCloudClient().listarPlantillas({
      accessToken: 'ficticio',
      wabaId: '123',
      despues: 'cursor-1',
    }),
  ).toEqual({ data: [], siguiente: 'cursor-2' });
  expect(mock).toHaveBeenCalledTimes(1);
  const [url, init] = mock.mock.calls[0];
  expect(url.origin).toBe('https://graph.facebook.com');
  expect(url.pathname).toBe('/v26.0/123/message_templates');
  expect(url.searchParams.get('after')).toBe('cursor-1');
  expect(url.href).not.toContain('ficticio');
  expect(init.redirect).toBe('error');
});
it('conserva parámetros named y de encabezado en el POST', async () => {
  const mock = jest
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ id: 'wamid.plantilla' }] })),
    );
  global.fetch = mock;
  const componentes = [
    {
      type: 'header' as const,
      parameters: [
        { type: 'text' as const, parameter_name: 'pedido', text: '42' },
      ],
    },
  ];
  await new MetaCloudClient().enviarPlantilla({ ...args, componentes });
  expect(JSON.parse(mock.mock.calls[0][1].body).template.components).toEqual(
    componentes,
  );
});
it('sanitiza errores de catálogo y no repite solicitudes', async () => {
  const mock = jest.fn().mockRejectedValue(new Error('token-privado'));
  global.fetch = mock;
  await expect(
    new MetaCloudClient().listarPlantillas({
      accessToken: 'ficticio',
      wabaId: '123',
    }),
  ).rejects.toThrow('No se pudo consultar el catálogo de Meta.');
  expect(mock).toHaveBeenCalledTimes(1);
});

it('sube media por multipart al número propio sin publicar URLs de Grafo', async () => {
  const mock = jest.fn().mockResolvedValue(new Response('{"id":"98765"}'));
  global.fetch = mock;
  const bytes = Buffer.from('%PDF-1.7 prueba');
  expect(
    await new MetaCloudClient().subirArchivo({
      ...args,
      bytes,
      mime: 'application/pdf',
      nombre: 'Trabajo.pdf',
    }),
  ).toBe('98765');
  const [url, init] = mock.mock.calls[0];
  expect(url.origin).toBe('https://graph.facebook.com');
  expect(url.pathname).toBe('/v26.0/123456/media');
  expect(init.redirect).toBe('error');
  expect(init.headers).toEqual({ Authorization: 'Bearer token-sintetico' });
  expect(init.body.get('messaging_product')).toBe('whatsapp');
  expect(init.body.get('type')).toBe('application/pdf');
  expect(init.body.get('file').name).toBe('Trabajo.pdf');
  expect(Buffer.from(await init.body.get('file').arrayBuffer())).toEqual(bytes);
});
it('upload fallido no reintenta ni revela errores de Meta', async () => {
  const mock = jest.fn().mockRejectedValue(new Error('Token privado'));
  global.fetch = mock;
  await expect(
    new MetaCloudClient().subirArchivo({
      ...args,
      bytes: Buffer.from('%PDF-1.7'),
      mime: 'application/pdf',
      nombre: 'Ejemplo.pdf',
    }),
  ).rejects.toThrow('No se pudo preparar el archivo en Meta.');
  expect(mock).toHaveBeenCalledTimes(1);
});
it('bloquea upload excesivo o tipo no permitido antes de la red', async () => {
  global.fetch = jest.fn();
  for (const mime of ['text/html', 'image/jpeg'])
    await expect(
      new MetaCloudClient().subirArchivo({
        ...args,
        bytes: Buffer.alloc(5_000_001),
        mime,
        nombre: 'Ejemplo.jpg',
      }),
    ).rejects.toThrow();
  expect(global.fetch).not.toHaveBeenCalled();
});
