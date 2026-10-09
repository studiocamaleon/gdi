/* Los matchers asimétricos de Jest declaran su resultado como any. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ServiceUnavailableException, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { CorreoTransaccionalService } from './correo-transaccional.service';

jest.mock('resend', () => ({ Resend: jest.fn() }));
const enviar = jest.fn();
const ambiente = { ...process.env };
const datos = {
  para: 'destinatario@example.com',
  nombre: 'Lucas',
  empresa: 'Empresa',
  plan: 'Grafo Pro',
  trialDias: 30,
  url: 'https://grafoprint.com.ar/registro/verificar?token=ejemplo',
};

beforeEach(() => {
  process.env.RESEND_API_KEY = 'clave-simulada';
  process.env.RESEND_FROM = 'Grafo <registro@example.com>';
  process.env.RESEND_REPLY_TO = 'soporte@example.com';
  jest.clearAllMocks();
  jest
    .mocked(Resend)
    .mockImplementation(
      () => ({ emails: { send: enviar } }) as unknown as Resend,
    );
  enviar.mockResolvedValue({ data: { id: 'envio-simulado' }, error: null });
});
afterEach(() => {
  jest.restoreAllMocks();
  process.env = { ...ambiente };
});

it('envía HTML y texto de la misma oferta con marca inline al destinatario indicado', async () => {
  await expect(
    new CorreoTransaccionalService().enviarVerificacion(datos),
  ).resolves.toEqual({ id: 'envio-simulado' });
  expect(enviar).toHaveBeenCalledWith(
    expect.objectContaining({
      from: 'Grafo <registro@example.com>',
      to: datos.para,
      replyTo: 'soporte@example.com',
      subject: 'Confirmá tu correo · Grafo',
      text: expect.stringContaining('30 días de prueba'),
      html: expect.stringContaining('cid:marca-grafoprint'),
      attachments: [
        expect.objectContaining({
          contentId: 'marca-grafoprint',
          content: expect.any(Buffer),
        }),
      ],
    }),
    expect.any(Object),
  );
});

it('conserva la clave de idempotencia en los reintentos de prueba', async () => {
  await new CorreoTransaccionalService().enviarVerificacion(datos, {
    prueba: true,
    idempotencyKey: 'prueba/uno',
  });
  expect(enviar).toHaveBeenCalledWith(
    expect.objectContaining({ subject: '[PRUEBA] Confirmá tu correo · Grafo' }),
    { idempotencyKey: 'prueba/uno' },
  );
});

it('no presenta como enviado un rechazo del proveedor', async () => {
  enviar.mockResolvedValue({ data: null, error: { message: 'rechazado' } });
  await expect(
    new CorreoTransaccionalService().enviarVerificacion(datos),
  ).rejects.toBeInstanceOf(ServiceUnavailableException);
});

it('el correo simulado no imprime el enlace ni el destinatario', async () => {
  delete process.env.RESEND_API_KEY;
  process.env.NODE_ENV = 'development';
  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  await new CorreoTransaccionalService().enviarVerificacion(datos);
  expect(JSON.stringify(warn.mock.calls)).not.toContain(datos.url);
  expect(JSON.stringify(warn.mock.calls)).not.toContain(datos.para);
});
it('el rechazo del proveedor no imprime sus datos ni mensajes privados', async () => {
  const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  enviar.mockResolvedValue({
    data: null,
    error: { message: `token=privado para ${datos.para}` },
  });
  await expect(
    new CorreoTransaccionalService().enviarVerificacion(datos),
  ).rejects.toBeInstanceOf(ServiceUnavailableException);
  expect(JSON.stringify(error.mock.calls)).not.toContain(datos.para);
  expect(JSON.stringify(error.mock.calls)).not.toContain('token=privado');
});
