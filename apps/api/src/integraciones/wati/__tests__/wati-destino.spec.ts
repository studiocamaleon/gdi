import { WatiClient, exigirHttps } from '../wati.client';

describe('Destino de credenciales Wati', () => {
  const original = global.fetch;
  let llamar: jest.Mock;
  beforeEach(() => {
    llamar = jest
      .fn()
      .mockResolvedValue(
        new Response('{"messageTemplates":[]}', { status: 200 }),
      );
    global.fetch = llamar;
  });
  afterEach(() => {
    global.fetch = original;
  });
  it.each([
    'https://127.0.0.1',
    'https://169.254.169.254',
    'https://api.internal',
    'https://live-mt-server.wati.io.example.invalid',
    'https://example.invalid',
    'https://live-mt-server.wati.io:8443',
    'https://usuario:clave@live-mt-server.wati.io',
  ])('rechaza un servidor no autorizado: %s', async (endpoint) => {
    expect(exigirHttps(endpoint)).not.toBeNull();
    await expect(
      new WatiClient().listarPlantillas({
        endpoint,
        tenantId: '123456',
        token: 'ficticio',
      }),
    ).rejects.toThrow();
    expect(llamar).not.toHaveBeenCalled();
  });
  it('no sigue redirecciones con credenciales ni hacia servicios internos', async () => {
    await new WatiClient().listarPlantillas({
      endpoint: 'https://live-mt-server.wati.io',
      tenantId: '123456',
      token: 'ficticio',
    });
    expect(llamar).toHaveBeenCalledWith(
      'https://live-mt-server.wati.io/123456/api/v1/getMessageTemplates',
      expect.objectContaining({ redirect: 'error' }),
    );
  });
});
