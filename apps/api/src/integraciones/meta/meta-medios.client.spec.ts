import { MetaCloudClient } from './meta-cloud.client';
const fetchAnterior = global.fetch;
const secretoAnterior = process.env.META_APP_SECRET;
const args = {
  accessToken: 'token-ficticio',
  phoneNumberId: '123456',
  telefono: '+16505550123',
  correlacion: 'carga-ficticia',
};
beforeEach(() => {
  process.env.META_APP_SECRET = 'secreto-ficticio';
});
afterEach(() => {
  global.fetch = fetchAnterior;
  if (secretoAnterior === undefined) delete process.env.META_APP_SECRET;
  else process.env.META_APP_SECRET = secretoAnterior;
});
it.each(['image', 'video', 'audio', 'document', 'sticker'] as const)(
  'envía %s por ID privado y limita los campos al tipo',
  async (tipo) => {
    const mock = jest
      .fn<Promise<Response>, Parameters<typeof fetch>>()
      .mockResolvedValue(
        new Response(JSON.stringify({ messages: [{ id: 'wamid.medio' }] }), {
          status: 200,
        }),
      );
    global.fetch = mock;
    await new MetaCloudClient().enviarMedio({
      ...args,
      tipo,
      mediaId: '12345',
      nombreArchivo: 'Muestra.pdf',
      texto: 'Texto de ejemplo',
      voz: tipo === 'audio',
    });
    const body = mock.mock.calls[0][1]?.body;
    if (typeof body !== 'string') throw new Error('Se esperaba JSON de Graph');
    const p = JSON.parse(body) as Record<string, unknown>;
    expect(p.type).toBe(tipo);
    expect(p[tipo]).toMatchObject({ id: '12345' });
    expect(p[tipo]).not.toHaveProperty('link');
    if (tipo === 'audio') expect(p.audio).toEqual({ id: '12345', voice: true });
    if (tipo === 'sticker') expect(p.sticker).toEqual({ id: '12345' });
    if (tipo === 'document')
      expect(p.document).toMatchObject({
        filename: 'Muestra.pdf',
        caption: 'Texto de ejemplo',
      });
  },
);
