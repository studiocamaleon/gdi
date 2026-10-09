import { crearCorreoAcceso } from './acceso';
import { CorreoTransaccionalService } from '../correo-transaccional.service';
describe('Correo de recuperación sin proveedores reales', () => {
  const anterior = process.env.RESEND_API_KEY;
  afterEach(() => {
    jest.restoreAllMocks();
    if (anterior === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = anterior;
  });
  it.each(['verificar', 'restablecer'])(
    'conserva el fragmento del enlace %s y escapa el HTML',
    (tipo) => {
      const url =
        'https://ejemplo.invalid/recuperar-acceso#modo=verificar&token=abc"<dato>';
      const correo = crearCorreoAcceso({
        tipo,
        para: 'ficticio@example.invalid',
        url,
      });
      expect(correo.text).toContain(url);
      expect(correo.html).toContain('&amp;token=abc&quot;&lt;dato&gt;');
      expect(correo.html).not.toContain('<dato>');
      expect(correo.text).toContain('15 minutos');
    },
  );
  it('el aviso no contiene un enlace de acceso ni una contraseña', () => {
    const correo = crearCorreoAcceso({
      tipo: 'aviso',
      para: 'ficticio@example.invalid',
    });
    expect(correo.text).toContain('sesiones anteriores');
    expect(correo.text).not.toContain('token=');
    expect(correo.html).not.toContain('href=');
  });
  it('envía a Resend con tiempo máximo, destino fijo e idempotencia estable', async () => {
    process.env.RESEND_API_KEY = 're_clave_ficticia_no_operativa';
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"id":"ficticio"}', { status: 200 }));
    await new CorreoTransaccionalService().enviarAcceso(
      { tipo: 'aviso', para: 'ficticio@example.invalid' },
      'acceso-ensayo-ficticio',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [destino, opciones] = fetchMock.mock.calls[0];
    expect(destino).toBe('https://api.resend.com/emails');
    expect(opciones?.redirect).toBe('error');
    expect(opciones?.signal).toBeInstanceOf(AbortSignal);
    expect(opciones?.headers).toMatchObject({
      'idempotency-key': 'acceso-ensayo-ficticio',
    });
    const body = JSON.parse(opciones?.body as string) as {
      to: string[];
      attachments: Array<{ content_id: string }>;
    };
    expect(body.to).toEqual(['ficticio@example.invalid']);
    expect(body.attachments[0].content_id).toBe('marca-grafoprint');
  });
  it('un rechazo o ausencia de configuración no se presenta como envío exitoso', async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('fallo', { status: 503 }));
    await expect(
      new CorreoTransaccionalService().enviarAcceso(
        { tipo: 'aviso', para: 'ficticio@example.invalid' },
        'ensayo',
      ),
    ).rejects.toThrow('no configurado');
    expect(fetchMock).not.toHaveBeenCalled();
    process.env.RESEND_API_KEY = 're_clave_ficticia_no_operativa';
    await expect(
      new CorreoTransaccionalService().enviarAcceso(
        { tipo: 'aviso', para: 'ficticio@example.invalid' },
        'ensayo',
      ),
    ).rejects.toThrow('no pudo enviarse');
  });
});
