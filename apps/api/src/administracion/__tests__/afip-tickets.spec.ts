import { AfipSdkProvider } from '../invoicing/afip-sdk.provider';

const instante = Date.parse('2026-09-22T12:00:00Z');
const envOriginal = {
  token: process.env.AFIPSDK_ACCESS_TOKEN,
  ambiente: process.env.AFIPSDK_ENVIRONMENT,
  cuit: process.env.AFIPSDK_DEV_CUIT,
};
let ahora: number;
let auth: jest.Mock<Promise<unknown>, []>;
let fetchMock: jest.SpyInstance;

const ticket = (expira = instante + 12 * 60 * 60_000) => ({
  token: 'ticket-de-prueba',
  sign: 'firma-de-prueba',
  expiration: new Date(expira).toISOString(),
});
const consultar = (svc: AfipSdkProvider, cuit = '20000000001') =>
  svc.ultimoNumero(1, 'factura', 'B', cuit);
const peticiones = (path: string) =>
  fetchMock.mock.calls
    .filter(([url]: [string]) => url.endsWith(path))
    .map(([, options]: [string, RequestInit]) => ({
      body: JSON.parse(options.body as string) as Record<string, unknown>,
      headers: options.headers,
    }));

beforeEach(() => {
  ahora = instante;
  process.env.AFIPSDK_ACCESS_TOKEN = 'credencial-simulada-uno';
  process.env.AFIPSDK_ENVIRONMENT = 'dev';
  delete process.env.AFIPSDK_DEV_CUIT;
  jest.spyOn(Date, 'now').mockImplementation(() => ahora);
  auth = jest.fn(() => Promise.resolve(ticket()));
  fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (url) => {
    const result = (url as string).endsWith('/auth')
      ? await auth()
      : { FECompUltimoAutorizadoResult: { CbteNro: 10 } };
    return new Response(JSON.stringify(result), { status: 200 });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  for (const [key, value] of Object.entries({
    AFIPSDK_ACCESS_TOKEN: envOriginal.token,
    AFIPSDK_ENVIRONMENT: envOriginal.ambiente,
    AFIPSDK_DEV_CUIT: envOriginal.cuit,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

it('agrupa la autorización simultánea y reutiliza el TA vigente', async () => {
  const svc = new AfipSdkProvider();
  expect(
    await Promise.all(Array.from({ length: 8 }, () => consultar(svc))),
  ).toEqual(Array(8).fill(10));
  expect(await consultar(svc)).toBe(10);
  expect(peticiones('/auth')).toEqual([
    {
      body: { environment: 'dev', tax_id: '20000000001', wsid: 'wsfe' },
      headers: {
        Authorization: 'Bearer credencial-simulada-uno',
        'Content-Type': 'application/json',
      },
    },
  ]);
  expect(peticiones('/requests')).toHaveLength(9);
  expect(peticiones('/requests')[0].body.params).toMatchObject({
    Auth: {
      Token: 'ticket-de-prueba',
      Sign: 'firma-de-prueba',
      Cuit: '20000000001',
    },
  });
});

it('un fallo de autorización no envenena los intentos posteriores', async () => {
  auth.mockRejectedValueOnce(new Error('No disponible'));
  const svc = new AfipSdkProvider();
  const resultados = await Promise.allSettled([consultar(svc), consultar(svc)]);
  expect(resultados.map((r) => r.status)).toEqual(['rejected', 'rejected']);
  expect(peticiones('/auth')).toHaveLength(1);
  expect(peticiones('/requests')).toHaveLength(0);
  expect(await consultar(svc)).toBe(10);
  expect(peticiones('/auth')).toHaveLength(2);
});

it('separa emisores, ambientes y rotación de credencial', async () => {
  const svc = new AfipSdkProvider();
  await consultar(svc);
  await consultar(svc, '20000000002');
  process.env.AFIPSDK_ENVIRONMENT = 'prod';
  await consultar(svc);
  process.env.AFIPSDK_ACCESS_TOKEN = 'credencial-simulada-dos';
  await consultar(svc);
  expect(peticiones('/auth').map((r) => r.body)).toEqual([
    { environment: 'dev', tax_id: '20000000001', wsid: 'wsfe' },
    { environment: 'dev', tax_id: '20000000002', wsid: 'wsfe' },
    { environment: 'prod', tax_id: '20000000001', wsid: 'wsfe' },
    { environment: 'prod', tax_id: '20000000001', wsid: 'wsfe' },
  ]);
  expect(peticiones('/requests')[3].headers).toMatchObject({
    Authorization: 'Bearer credencial-simulada-dos',
  });
});

it('mantiene la misma conexión si la configuración cambia durante la autorización', async () => {
  auth.mockImplementationOnce(() => {
    process.env.AFIPSDK_ENVIRONMENT = 'prod';
    process.env.AFIPSDK_ACCESS_TOKEN = 'otra-credencial';
    return Promise.resolve(ticket());
  });
  await consultar(new AfipSdkProvider());
  expect(peticiones('/requests')[0]).toMatchObject({
    body: { environment: 'dev' },
    headers: { Authorization: 'Bearer credencial-simulada-uno' },
  });
});

it('consulta la caché remota cerca del vencimiento sin forzar otro TA', async () => {
  const svc = new AfipSdkProvider();
  await consultar(svc);
  ahora = instante + 12 * 60 * 60_000 - 4 * 60_000;
  await consultar(svc);
  expect(peticiones('/auth')).toHaveLength(2);
  expect(peticiones('/auth')[1].body).not.toHaveProperty('force_create');
  expect(peticiones('/requests')).toHaveLength(2);
});

it.each([
  null,
  {},
  { ...ticket(), token: '' },
  { ...ticket(), sign: ' ' },
  { ...ticket(), expiration: 'fecha inválida' },
  ticket(instante - 1),
  ticket(instante + 10_000),
])('rechaza un TA inválido sin llamar al webservice: %j', async (respuesta) => {
  auth.mockResolvedValueOnce(respuesta);
  const svc = new AfipSdkProvider();
  await expect(consultar(svc)).rejects.toThrow(
    'ticket de acceso válido y vigente',
  );
  expect(peticiones('/requests')).toHaveLength(0);
  expect(await consultar(svc)).toBe(10);
});

it('no reutiliza un ticket cuando se retira la credencial', async () => {
  const svc = new AfipSdkProvider();
  await consultar(svc);
  delete process.env.AFIPSDK_ACCESS_TOKEN;
  await expect(consultar(svc)).rejects.toThrow('Falta AFIPSDK_ACCESS_TOKEN');
  expect(peticiones('/requests')).toHaveLength(1);
});
