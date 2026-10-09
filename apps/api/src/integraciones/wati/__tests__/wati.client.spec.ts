import { baseDe, minutosDeEspera, WatiClient } from '../wati.client';

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

  describe('enviarPlantilla', () => {
    const client = new WatiClient();
    const fetchOriginal = global.fetch;
    afterEach(() => {
      global.fetch = fetchOriginal;
    });

    const cuerpoEnviado = () => {
      const [, opciones] = (global.fetch as jest.Mock).mock.calls[0] as [
        string,
        RequestInit,
      ];
      return JSON.parse(opciones.body as string) as Record<string, unknown>;
    };

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ result: true })),
      }) as unknown as typeof fetch;
    });

    it('envía la imagen mediante la variable del encabezado, sin header ignorado por Wati', async () => {
      await client.enviarPlantilla(cred, {
        telefono: '5491150000000',
        plantilla: 'grafo_orden_lista_qr_v1',
        parametros: { nombre_cliente: 'Ana' },
        mediaHeaderUrl: 'https://r2.example/qr.png',
        mediaHeaderParam: 'qr_url',
      });
      expect(cuerpoEnviado().parameters).toContainEqual({ name: 'qr_url', value: 'https://r2.example/qr.png' });
      expect(cuerpoEnviado()).not.toHaveProperty('header');
    });

    it('no manda header en las de texto puro', async () => {
      await client.enviarPlantilla(cred, {
        telefono: '5491150000000',
        plantilla: 'grafo_orden_recibida_v2',
        parametros: { nombre_cliente: 'Ana' },
      });
      expect(cuerpoEnviado()).not.toHaveProperty('header');
    });

    it.each([0, 200, 500, 502, 504])(
      'una respuesta no confirmada (%s) no autoriza reintentar el mensaje',
      async (status) => {
        global.fetch =
          status === 0
            ? jest.fn().mockRejectedValue(new Error('timeout'))
            : jest.fn().mockResolvedValue({
                ok: status === 200,
                status,
                text: () => Promise.resolve(status === 200 ? '{}' : 'Error'),
              });
        expect(
          await client.enviarPlantilla(cred, {
            telefono: '5491150000000',
            plantilla: 'prueba',
            parametros: {},
          }),
        ).toMatchObject({ ok: false, incierto: true });
      },
    );

    it.each([400, 401, 403, 404, 422, 429])(
      'un rechazo HTTP %s es una respuesta negativa confirmada',
      async (status) => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status,
          text: () => Promise.resolve('Rejected'),
        });
        expect(
          await client.enviarPlantilla(cred, {
            telefono: '5491150000000',
            plantilla: 'prueba',
            parametros: {},
          }),
        ).toMatchObject({ ok: false, incierto: false });
      },
    );

    it('conserva el rechazo explícito de Wati aunque el HTTP sea exitoso', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve('{"result":false,"info":"Plantilla rechazada"}'),
      });
      expect(
        await client.enviarPlantilla(cred, {
          telefono: '5491150000000',
          plantilla: 'prueba',
          parametros: {},
        }),
      ).toMatchObject({
        ok: false,
        incierto: false,
        motivo: 'Plantilla rechazada',
      });
    });
  });
});

describe('minutosDeEspera', () => {
  it('reconoce el cupo de plantillas por hora y saca los minutos', () => {
    expect(
      minutosDeEspera(
        'Only 10 templates can be submitted per hour, please wait for 22 minutes before submit again.',
      ),
    ).toBe(22);
  });

  it('cae a una hora si frena por cupo pero no dice cuánto', () => {
    expect(minutosDeEspera('Rate limit reached.')).toBe(60);
  });

  /**
   * El punto de la función: distinguir "esperá" de "está roto". Un fallo
   * común no puede leerse como cupo, porque el front deja de intentar.
   */
  it('no confunde un error cualquiera con una espera', () => {
    expect(minutosDeEspera('Wati rechazó el token.')).toBeUndefined();
    expect(
      minutosDeEspera('template with current name already exists'),
    ).toBeUndefined();
    expect(
      minutosDeEspera('Wati tuvo un error interno (500).'),
    ).toBeUndefined();
  });
});

describe('contrato de imagen variable y aceptación v2', () => {
  const cred = { endpoint: 'https://live-mt-server.wati.io', tenantId: '123456', token: 'ficticio' };
  const envio = { telefono: '5491150000000', plantilla: 'qr_ficticio', parametros: { numero_orden: 'OT-QA' } };
  afterEach(() => jest.restoreAllMocks());
  it('bloquea la imagen estática antes de cualquier POST', async () => {
    const fetch = jest.spyOn(global, 'fetch');
    expect(await new WatiClient().enviarPlantilla(cred, { ...envio, mediaHeaderUrl: 'https://example.test/qr.png' })).toMatchObject({ ok: false, incierto: false });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('conserva el localMessageId del destinatario y usa el endpoint v2', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ result: true, receivers: [{ waId: envio.telefono, localMessageId: 'id-ficticio', isValidWhatsAppNumber: true, errors: [] }] })));
    expect(await new WatiClient().enviarPlantilla(cred, envio)).toEqual({ ok: true, id: 'id-ficticio' });
    expect(fetch.mock.calls[0][0]).toContain('/123456/api/v2/sendTemplateMessage?');
  });
  it('no trata un destinatario inválido como aceptación', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ result: true, receivers: [{ waId: envio.telefono, isValidWhatsAppNumber: false, errors: [] }] })));
    expect(await new WatiClient().enviarPlantilla(cred, envio)).toMatchObject({ ok: false, incierto: false });
  });
  it('crea el encabezado variable y su muestra sólo para aprobación', async () => {
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{"ok":true}'));
    await new WatiClient().crearPlantilla(cred, { codigo: 'qr_ficticio', categoria: 'UTILITY', idioma: 'es_AR', cuerpo: 'Orden {{1}}', footer: 'QA', parametros: [{ nombre: 'orden', ejemplo: 'OT-QA' }], encabezado: { tipo: 'IMAGE', ejemploUrl: 'https://example.test/muestra.png' } });
    const body = JSON.parse(fetch.mock.calls[0][1]!.body as string);
    expect(body.header.link).toBe('{{qr_url}}');
    expect(body.customParams).toContainEqual({ paramName: 'qr_url', paramValue: 'https://example.test/muestra.png' });
  });
});
