import { baseDe, WatiClient } from '../wati.client';

/**
 * Los dos lugares donde este cliente se rompe en la práctica: cómo se arma la
 * URL (Wati mete el tenant en el path, no en un header) y qué se le muestra
 * al usuario cuando falla. Un "Request failed with status 401" en la pantalla
 * de configuración no le sirve a nadie.
 */
describe('WatiClient', () => {
  const cred = {
    endpoint: 'https://live-mt-server.wati.io',
    tenantId: '313754',
    token: 'un-token-largo-de-prueba-1234567890',
  };

  describe('baseDe', () => {
    it('pega el tenant id al endpoint', () => {
      expect(baseDe(cred)).toBe('https://live-mt-server.wati.io/313754');
    });

    it('NO lo duplica si el usuario ya lo pegó', () => {
      // El dashboard de Wati muestra la URL con el tenant incluido, así que
      // esto va a pasar la mitad de las veces. Sin esto la URL saldría
      // .../313754/313754/api/... y el error sería un 404 incomprensible.
      expect(
        baseDe({ ...cred, endpoint: 'https://live-mt-server.wati.io/313754' }),
      ).toBe('https://live-mt-server.wati.io/313754');
    });

    it('tolera barras y espacios de sobra', () => {
      expect(
        baseDe({ ...cred, endpoint: '  https://live-mt-server.wati.io///  ' }),
      ).toBe('https://live-mt-server.wati.io/313754');
    });

    it('no confunde un tenant que es sufijo de otro', () => {
      // '13754' es sufijo de '313754': un endsWith ingenuo sobre el número
      // pelado daría falso positivo. Por eso se compara con la barra.
      expect(
        baseDe({
          endpoint: 'https://live-mt-server.wati.io/313754',
          tenantId: '13754',
          token: 'x',
        }),
      ).toBe('https://live-mt-server.wati.io/313754/13754');
    });
  });

  describe('probar', () => {
    const client = new WatiClient();
    const fetchOriginal = global.fetch;
    afterEach(() => {
      global.fetch = fetchOriginal;
    });

    const responder = (status: number, cuerpo: string) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        text: () => Promise.resolve(cuerpo),
      }) as unknown as typeof fetch;
    };

    it('cuenta los templates cuando la conexión anda', async () => {
      responder(
        200,
        JSON.stringify({
          messageTemplates: [
            { elementName: 'a', status: 'APPROVED' },
            { elementName: 'b', status: 'PENDING' },
          ],
        }),
      );
      await expect(client.probar(cred)).resolves.toEqual({
        ok: true,
        templates: 2,
      });
    });

    it('llama a la URL con el tenant en el path y el Bearer', async () => {
      responder(200, JSON.stringify({ messageTemplates: [] }));
      await client.probar(cred);
      const [url, opciones] = (global.fetch as jest.Mock).mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(url).toBe(
        'https://live-mt-server.wati.io/313754/api/v1/getMessageTemplates',
      );
      expect((opciones.headers as Record<string, string>).Authorization).toBe(
        `Bearer ${cred.token}`,
      );
    });

    it('un 401 explica que hay que regenerar el token', async () => {
      responder(401, 'Unauthorized');
      const r = await client.probar(cred);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toMatch(/token/i);
    });

    it('un 404 apunta al Tenant ID, que es la causa habitual', async () => {
      responder(404, 'Not Found');
      const r = await client.probar(cred);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toMatch(/Tenant ID/i);
    });

    it('un HTML de error no se cuela como si fuera JSON', async () => {
      // Pasa cuando el endpoint apunta a cualquier otra cosa: el status es
      // 200 pero el cuerpo es una página web.
      responder(200, '<!doctype html><html>...');
      const r = await client.probar(cred);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toMatch(/endpoint/i);
    });

    it('nunca lanza: un fallo de red es información, no una excepción', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('getaddrinfo ENOTFOUND')) as never;
      await expect(client.probar(cred)).resolves.toMatchObject({ ok: false });
    });

    it('un timeout se reporta como tal', async () => {
      const err = new Error('timed out');
      err.name = 'TimeoutError';
      global.fetch = jest.fn().mockRejectedValue(err) as never;
      const r = await client.probar(cred);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toMatch(/no respondió/i);
    });
  });
});
