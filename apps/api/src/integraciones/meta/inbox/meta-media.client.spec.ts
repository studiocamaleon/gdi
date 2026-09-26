import { createHash } from 'node:crypto';
import {
  ErrorMediaMeta,
  MetaMediaClient,
  nombreMedia,
} from './meta-media.client';
const contenido = Buffer.from('%PDF-1.4\narchivo ficticio');
const hash = createHash('sha256').update(contenido).digest('hex');
const metadata = {
  id: '123',
  url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/?id=123',
  mime_type: 'application/pdf',
  file_size: String(contenido.length),
  sha256: hash,
};
const params = {
  mediaId: '123',
  phoneNumberId: '456',
  token: 'token-ficticio',
  appSecret: 'secreto-ficticio',
  version: 'v26.0',
  tipo: 'document',
  sha256: Buffer.from(hash, 'hex').toString('base64'),
};
const client = new MetaMediaClient();
let f: jest.SpyInstance<ReturnType<typeof fetch>, Parameters<typeof fetch>>;
beforeEach(() => {
  f = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Red prohibida'));
});
afterEach(() => jest.restoreAllMocks());
it('consulta el medio con el número propio y comprueba tamaño, MIME y hash', async () => {
  f.mockResolvedValueOnce(Response.json(metadata)).mockResolvedValueOnce(
    new Response(contenido, {
      headers: {
        'content-type': 'application/pdf',
        'content-length': String(contenido.length),
      },
    }),
  );
  const meta = await client.metadata(params);
  const [url, opts] = f.mock.calls[0];
  const parsedUrl = new URL(url instanceof Request ? url.url : url);
  expect(parsedUrl.searchParams.get('phone_number_id')).toBe('456');
  expect(new Headers(opts?.headers).get('Authorization')).toBe(
    'Bearer token-ficticio',
  );
  expect(opts?.redirect).toBe('error');
  expect(await client.descargar(meta, params.token)).toEqual(contenido);
  expect(f.mock.calls[1][1]?.redirect).toBe('error');
});
it.each([
  'https://evil.example/archivo',
  'http://lookaside.fbsbx.com/whatsapp_business/attachments/',
  'https://lookaside.fbsbx.com.evil.example/whatsapp_business/attachments/',
  'https://lookaside.fbsbx.com:8443/whatsapp_business/attachments/',
  'https://x@lookaside.fbsbx.com/whatsapp_business/attachments/',
])('no entrega credenciales a %s', async (url) => {
  f.mockResolvedValueOnce(Response.json({ ...metadata, url }));
  await expect(client.metadata(params)).rejects.toMatchObject({
    codigo: 'DESTINO',
  });
  expect(f).toHaveBeenCalledTimes(1);
});
it.each([
  [{ file_size: '100000001' }, 'LIMITE'],
  [{ file_size: '-1' }, 'LIMITE'],
  [{ file_size: '1.5' }, 'LIMITE'],
  [{ mime_type: 'text/html' }, 'FORMATO'],
  [{ mime_type: 'image/png' }, 'FORMATO'],
  [{ id: '999' }, 'FORMATO'],
  [{ sha256: 'f'.repeat(64) }, 'INTEGRIDAD'],
])('rechaza metadata inconsistente %j', async (mod, codigo) => {
  f.mockResolvedValueOnce(Response.json({ ...metadata, ...mod }));
  await expect(client.metadata(params)).rejects.toMatchObject({ codigo });
});
it('no interpreta URLs como media ID', async () => {
  await expect(
    client.metadata({ ...params, mediaId: '../../secrets' }),
  ).rejects.toBeInstanceOf(ErrorMediaMeta);
  expect(f).not.toHaveBeenCalled();
});
it('limita el JSON', async () => {
  f.mockResolvedValueOnce(new Response(' '.repeat(20000)));
  await expect(client.metadata(params)).rejects.toMatchObject({
    codigo: 'FORMATO',
  });
});
it.each([
  [Buffer.from('x'.repeat(contenido.length + 1)), 'application/pdf', 'LIMITE'],
  [contenido.subarray(0, 4), 'application/pdf', 'INTEGRIDAD'],
  [Buffer.from('x'.repeat(contenido.length)), 'application/pdf', 'INTEGRIDAD'],
  [contenido, 'text/html', 'INTEGRIDAD'],
])('controla los bytes reales', async (bytes, mime, codigo) => {
  f.mockResolvedValueOnce(Response.json(metadata)).mockResolvedValueOnce(
    new Response(bytes, { headers: { 'content-type': mime } }),
  );
  await expect(
    client.descargar(await client.metadata(params), params.token),
  ).rejects.toMatchObject({ codigo });
});
it('rechaza HTML renombrado PDF incluso con hash correcto', async () => {
  const falso = Buffer.from('<script>1</script>'),
    sha = createHash('sha256').update(falso).digest('hex');
  f.mockResolvedValueOnce(
    Response.json({ ...metadata, file_size: falso.length, sha256: sha }),
  ).mockResolvedValueOnce(
    new Response(falso, { headers: { 'content-type': 'application/pdf' } }),
  );
  await expect(
    client.descargar(
      await client.metadata({ ...params, sha256: sha }),
      params.token,
    ),
  ).rejects.toMatchObject({ codigo: 'INTEGRIDAD' });
});
it('no propaga errores crudos', async () => {
  f.mockRejectedValue(new Error('token y URL privados'));
  await expect(client.metadata(params)).rejects.toEqual(
    new ErrorMediaMeta('TEMPORAL'),
  );
});
it('limpia nombres y conserva extensión del formato', () => {
  expect(nombreMedia('../pedido\r\n.html', 'pdf')).toBe('.._pedido__.pdf');
  expect(nombreMedia(null, 'ogg')).toBe('Adjunto.ogg');
});
