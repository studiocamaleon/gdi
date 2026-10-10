import { AfipSdkProvider } from '../invoicing/afip-sdk.provider';

describe('ARCA — credenciales de producción y errores seguros', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
    jest.restoreAllMocks();
  });

  it('no inicia autenticación de producción sin certificado configurado', async () => {
    process.env.AFIPSDK_ACCESS_TOKEN = 'token-ficticio';
    process.env.AFIPSDK_ENVIRONMENT = 'prod';
    const remoto = jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            token: 'ta-ficticio',
            sign: 'firma-ficticia',
            expiration: new Date(Date.now() + 3600_000).toISOString(),
          }),
        ),
      ),
    );
    await expect(
      new AfipSdkProvider().ultimoNumero(1, 'factura', 'B', '20000000001'),
    ).rejects.toThrow(/certificado/i);
    expect(remoto).not.toHaveBeenCalled();
  });

  it('no devuelve al usuario el cuerpo de errores del proveedor', async () => {
    process.env.AFIPSDK_ACCESS_TOKEN = 'token-ficticio';
    process.env.AFIPSDK_ENVIRONMENT = 'dev';
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response('eco de clave-privada-ficticia', { status: 401 }),
      );
    const resultado = await new AfipSdkProvider().verificarDelegacion(
      '20000000001',
      1,
    );
    expect(resultado.ok).toBe(false);
    expect(resultado.motivo).not.toContain('clave-privada-ficticia');
  });
});
