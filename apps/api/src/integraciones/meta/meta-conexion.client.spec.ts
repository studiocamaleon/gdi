import { MetaConexionClient } from './meta-conexion.client';

const config = {
  appId: '100001',
  appSecret: 'secreto-sintetico',
  configId: '100002',
  sandboxWabaId: '200001',
  graphVersion: 'v26.0',
};
const token = 'token-opaco-sintetico';
const seleccion = { wabaId: '200001', phoneNumberId: '300001' };
const debug = () => ({
  data: {
    app_id: config.appId,
    is_valid: true,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    data_access_expires_at: 0,
    scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
    granular_scopes: [
      { scope: 'whatsapp_business_management', target_ids: [seleccion.wabaId] },
    ],
  },
});
const lista = {
  data: [
    {
      id: seleccion.phoneNumberId,
      display_phone_number: '+1 650-555-0123',
      verified_name: 'Imprenta de prueba',
    },
  ],
};
const detalle = {
  id: seleccion.phoneNumberId,
  is_on_biz_app: true,
  platform_type: 'CLOUD_API',
};
const fetchOriginal = global.fetch;
let fetchMock: jest.Mock<Promise<Response>, [URL, RequestInit]>;
const responder = (...bodies: unknown[]) => {
  for (const body of bodies)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status: 200 }),
    );
};
beforeEach(() => {
  fetchMock = jest
    .fn<Promise<Response>, [URL, RequestInit]>()
    .mockRejectedValue(new Error('Red no esperada'));
  global.fetch = fetchMock as typeof fetch;
});
afterEach(() => {
  global.fetch = fetchOriginal;
});

it('canjea una vez en el servidor y trata el token como opaco', async () => {
  responder({ access_token: token });
  expect(
    await new MetaConexionClient().canjear(config, 'codigo-sintetico'),
  ).toBe(token);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.origin).toBe('https://graph.facebook.com');
  expect(url.pathname).toBe('/v26.0/oauth/access_token');
  expect(url.searchParams.get('client_secret')).toBe(config.appSecret);
  expect(options).toMatchObject({ redirect: 'error', cache: 'no-store' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it.each([500, 429, 200])(
  'un resultado incierto (%s) no repite el canje ni filtra datos',
  async (status) => {
    fetchMock.mockResolvedValueOnce(new Response('dato-privado', { status }));
    await expect(
      new MetaConexionClient().canjear(config, 'codigo'),
    ).rejects.toThrow('RESPUESTA_INCIERTA');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);
it('un error de red se reemplaza sin conservar el secreto en cause', async () => {
  fetchMock.mockRejectedValueOnce(
    new Error('https://url-privada/token-secreto'),
  );
  try {
    await new MetaConexionClient().canjear(config, 'codigo');
    fail('Debía fallar');
  } catch (e) {
    expect(String(e)).toBe('Error: RESPUESTA_INCIERTA');
    expect((e as Error).cause).toBeUndefined();
  }
});
it('comprueba app, permisos, pertenencia y coexistencia; devuelve sólo activos confirmados', async () => {
  responder(debug(), lista, detalle);
  expect(
    await new MetaConexionClient().verificar(config, token, seleccion),
  ).toMatchObject({
    ...seleccion,
    numero: '+16505550123',
    nombreVerificado: 'Imprenta de prueba',
    accesoDatosVenceEl: null,
  });
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
    `Bearer ${config.appId}|${config.appSecret}`,
  );
  for (const [url, options] of fetchMock.mock.calls.slice(1)) {
    expect(url.origin).toBe('https://graph.facebook.com');
    expect(url.searchParams.get('appsecret_proof')).toMatch(/^[a-f0-9]{64}$/);
    expect(url.href).not.toContain(token);
    expect(options.headers.Authorization).toBe(`Bearer ${token}`);
    expect(options.redirect).toBe('error');
  }
});
it.each([
  ['otra app', { app_id: '99999' }, 'TOKEN_INVALIDO'],
  ['token revocado', { is_valid: false }, 'TOKEN_INVALIDO'],
  ['token vencido', { expires_at: 1 }, 'TOKEN_INVALIDO'],
  ['fecha ausente', { expires_at: undefined }, 'TOKEN_INVALIDO'],
  ['acceso a datos vencido', { data_access_expires_at: 1 }, 'TOKEN_INVALIDO'],
  [
    'permiso faltante',
    { scopes: ['whatsapp_business_management'] },
    'PERMISOS_INSUFICIENTES',
  ],
  [
    'cuenta fuera del alcance',
    {
      granular_scopes: [
        { scope: 'whatsapp_business_management', target_ids: ['9999'] },
      ],
    },
    'ACTIVO_NO_AUTORIZADO',
  ],
  [
    'alcance vacío',
    {
      granular_scopes: [
        { scope: 'whatsapp_business_messaging', target_ids: [] },
      ],
    },
    'ACTIVO_NO_AUTORIZADO',
  ],
])('rechaza %s antes de consultar activos', async (_caso, extra, motivo) => {
  responder({ data: { ...debug().data, ...(extra as object) } });
  await expect(
    new MetaConexionClient().verificar(config, token, seleccion),
  ).rejects.toThrow(motivo);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it('admite un scope general sin target_ids y siempre comprueba el edge de la cuenta', async () => {
  responder(
    {
      data: {
        ...debug().data,
        expires_at: 0,
        granular_scopes: [{ scope: 'whatsapp_business_management' }],
      },
    },
    lista,
    detalle,
  );
  expect(
    (await new MetaConexionClient().verificar(config, token, seleccion))
      .tokenVenceEl,
  ).toBeNull();
  expect(fetchMock.mock.calls[1][0].pathname).toBe(
    '/v26.0/200001/phone_numbers',
  );
});
it('rechaza un número válido de Graph que no pertenezca a la cuenta elegida', async () => {
  responder(debug(), { data: [] });
  await expect(
    new MetaConexionClient().verificar(config, token, seleccion),
  ).rejects.toThrow('ACTIVO_NO_AUTORIZADO');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('si el evento sólo trae la cuenta, resuelve su único número en el servidor', async () => {
  responder(debug(), lista, detalle);
  expect(
    (
      await new MetaConexionClient().verificar(config, token, {
        wabaId: seleccion.wabaId,
      })
    ).phoneNumberId,
  ).toBe(seleccion.phoneNumberId);
});
it('no elige arbitrariamente un número cuando hay más de uno', async () => {
  responder(debug(), {
    data: [...lista.data, { ...lista.data[0], id: '300002' }],
  });
  await expect(
    new MetaConexionClient().verificar(config, token, {
      wabaId: seleccion.wabaId,
    }),
  ).rejects.toThrow('NUMERO_AMBIGUO');
});
it('pagina mediante cursor y nunca sigue una URL next arbitraria con el token', async () => {
  responder(
    debug(),
    {
      data: [],
      paging: {
        next: 'https://ajeno.example.invalid/robar',
        cursors: { after: 'cursor-1' },
      },
    },
    lista,
    detalle,
  );
  await new MetaConexionClient().verificar(config, token, seleccion);
  expect(fetchMock.mock.calls[2][0].origin).toBe('https://graph.facebook.com');
  expect(fetchMock.mock.calls[2][0].searchParams.get('after')).toBe('cursor-1');
});
it.each([false, undefined])(
  'no aprueba una cuenta sin coexistencia confirmada: %s',
  async (is_on_biz_app) => {
    responder(debug(), lista, { ...detalle, is_on_biz_app });
    await expect(
      new MetaConexionClient().verificar(config, token, seleccion),
    ).rejects.toThrow('SIN_COEXISTENCIA');
  },
);
it('rechaza cursores repetidos en lugar de entrar en un bucle', async () => {
  const pagina = {
    data: [],
    paging: { next: 'otra-pagina', cursors: { after: 'mismo' } },
  };
  responder(debug(), pagina, pagina);
  await expect(
    new MetaConexionClient().verificar(config, token, seleccion),
  ).rejects.toThrow('RESPUESTA_INCIERTA');
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
it.each([
  { wabaId: '../otra-ruta' },
  { ...seleccion, phoneNumberId: '12?token=x' },
])('rechaza IDs manipulados sin llamar a la red', async (ids) => {
  await expect(
    new MetaConexionClient().verificar(config, token, ids),
  ).rejects.toThrow('DATOS_INVALIDOS');
  expect(fetchMock).not.toHaveBeenCalled();
});
it('sandbox consulta la WABA sin comprobar ni registrar números', async () => {
  responder(debug(), { id: seleccion.wabaId });
  await new MetaConexionClient().verificarSandbox(
    config,
    token,
    seleccion.wabaId,
  );
  expect(fetchMock.mock.calls.map((c) => c[0].pathname)).toEqual([
    '/v26.0/debug_token',
    '/v26.0/200001',
  ]);
});
it('contrato de suscripción y sincronización: Bearer, POST y request_id', async () => {
  responder(
    { success: true },
    { request_id: 'contactos-1' },
    { request_id: 'historial-1' },
  );
  const client = new MetaConexionClient();
  await client.suscribir(config, token, seleccion.wabaId);
  expect(
    await client.sincronizar(
      config,
      token,
      seleccion.phoneNumberId,
      'smb_app_state_sync',
    ),
  ).toBe('contactos-1');
  expect(
    await client.sincronizar(config, token, seleccion.phoneNumberId, 'history'),
  ).toBe('historial-1');
  expect(fetchMock.mock.calls.map((c) => c[0].pathname)).toEqual([
    '/v26.0/200001/subscribed_apps',
    '/v26.0/300001/smb_app_data',
    '/v26.0/300001/smb_app_data',
  ]);
  for (const [, options] of fetchMock.mock.calls)
    expect(options).toMatchObject({
      method: 'POST',
      redirect: 'error',
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
  const body = fetchMock.mock.calls[2][1].body;
  if (typeof body !== 'string') throw new Error('Falta el cuerpo JSON');
  expect(JSON.parse(body)).toMatchObject({
    messaging_product: 'whatsapp',
    sync_type: 'history',
    appsecret_proof: expect.stringMatching(/^[a-f0-9]{64}$/) as unknown,
  });
});
it.each([400, 429, 500, 200])(
  'POST fallido %s queda incierto/rechazado sin repetirse ni filtrar errores',
  async (status) => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'secreto-privado' } }), {
        status,
      }),
    );
    await expect(
      new MetaConexionClient().sincronizar(
        config,
        token,
        seleccion.phoneNumberId,
        'history',
      ),
    ).rejects.toThrow(
      status === 400 ? 'AUTORIZACION_RECHAZADA' : 'RESPUESTA_INCIERTA',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  },
);

it('sandbox rechaza una WABA distinta de la cuenta de ensayo configurada sin llamar a Meta', async () => {
  await expect(
    new MetaConexionClient().verificarSandbox(config, token, '999001'),
  ).rejects.toThrow('ACTIVO_NO_AUTORIZADO');
  expect(fetchMock).not.toHaveBeenCalled();
});

it('verifica prueba sin coexistencia, con vencimiento y app suscripta, sin POST', async () => {
  responder(
    debug(),
    lista,
    { ...detalle, is_on_biz_app: false },
    { data: [{ whatsapp_business_api_data: { id: config.appId } }] },
  );
  expect(
    await new MetaConexionClient().verificarPrueba(config, token, seleccion),
  ).toMatchObject(seleccion);
  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(
    fetchMock.mock.calls.every(([, o]) => !o.method || o.method === 'GET'),
  ).toBe(true);
});
it.each(['sin-suscripcion', 'sin-vencimiento'])(
  'bloquea prueba %s',
  async (caso) => {
    const d = debug();
    if (caso === 'sin-vencimiento') d.data.expires_at = 0;
    responder(d, lista, { ...detalle, is_on_biz_app: false }, { data: [] });
    await expect(
      new MetaConexionClient().verificarPrueba(config, token, seleccion),
    ).rejects.toThrow(
      caso === 'sin-vencimiento' ? 'TOKEN_INVALIDO' : 'ACTIVO_NO_AUTORIZADO',
    );
  },
);


it.each([
  'http://graph.facebook.com/v26.0/debug_token',
  'https://graph.facebook.com.ajeno.example.invalid/debug_token',
  'https://127.0.0.1/debug_token',
  'https://graph.facebook.com:8443/debug_token',
  'https://usuario:clave@graph.facebook.com/debug_token',
])('rechaza el destino no permitido antes de enviar credenciales: %s', async (destino) => {
  const client = new MetaConexionClient();
  // Se comprueba además la frontera interna de salida, sin llamadas de red.
  const leer = client as unknown as { leer(url: URL, token: string): Promise<unknown> };
  await expect(leer.leer(new URL(destino), token)).rejects.toThrow('DATOS_INVALIDOS');
  expect(fetchMock).not.toHaveBeenCalled();
});
