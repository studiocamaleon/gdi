import { Resend } from 'resend';
import { CorreoPresupuestoTransporte } from '../correo-presupuesto.transporte';
import {
  completarPlantilla,
  crearCorreoPresupuesto,
} from '../correo-presupuesto.plantilla';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EnviarCorreoPresupuestoDto } from '../dto/presupuestos.dto';

jest.mock('resend', () => ({ Resend: jest.fn() }));
const send = jest.fn();
const ambiente = { ...process.env };
const datos = {
  id: 'envio-1',
  empresa: 'Imprenta & Cía',
  numero: 'PRES-2026-001',
  asunto: 'Tu presupuesto',
  mensaje: 'Hola, <script>alert(1)</script>\nGracias.',
  url: 'https://grafo.example/p/token',
  responderA: 'ventas@imprenta.test',
  para: 'cliente@example.test',
  remitente: 'Imprenta vía Grafo <presupuestos@grafo.test>',
  pdf: Buffer.from('%PDF-1.7 Documento de prueba'),
};
beforeEach(() => {
  process.env.RESEND_API_KEY = 'clave-simulada';
  process.env.RESEND_FROM = 'Grafo <registro@grafo.test>';
  delete process.env.RESEND_PRESUPUESTOS_FROM;
  jest.clearAllMocks();
  jest
    .mocked(Resend)
    .mockImplementation(() => ({ emails: { send } }) as unknown as Resend);
  send.mockResolvedValue({ data: { id: 'resend-1' }, error: null });
});
afterEach(() => {
  process.env = { ...ambiente };
});

it('envía PDF y enlace, con respuestas al tenant y clave de idempotencia estable', async () => {
  const transporte = new CorreoPresupuestoTransporte();
  await expect(transporte.enviar(datos)).resolves.toBe('resend-1');
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      from: datos.remitente,
      to: datos.para,
      replyTo: datos.responderA,
      subject: datos.asunto,
      text: expect.stringContaining(datos.url),
      html: expect.stringContaining(`href="${datos.url}"`),
      attachments: expect.arrayContaining([
        expect.objectContaining({
          filename: 'PRES-2026-001.pdf',
          content: datos.pdf,
          contentType: 'application/pdf',
        }),
      ]),
    }),
    { idempotencyKey: 'presupuesto-correo/envio-1' },
  );
});

it('escapa el contenido editable en HTML y conserva sus saltos de línea', () => {
  const correo = crearCorreoPresupuesto(datos);
  expect(correo.html).not.toContain('<script>');
  expect(correo.html).toContain('&lt;script&gt;');
  expect(correo.html).toContain('<br>Gracias.');
  expect(correo.html).toContain('Imprenta &amp; Cía');
});

it('el remitente mantiene la dirección de Grafo aunque cambie la empresa', () => {
  const transporte = new CorreoPresupuestoTransporte();
  expect(transporte.remitente('Imprenta <otra@empresa.test>\r\n')).toBe(
    '"Imprenta otra@empresa.test vía Grafo" <cotizaciones@grafoprint.com.ar>',
  );
});

it('permite configurar la casilla de cotizaciones de forma independiente del correo de registro', () => {
  process.env.RESEND_PRESUPUESTOS_FROM = 'Grafo <cotizaciones@grafo.test>';
  expect(new CorreoPresupuestoTransporte().remitente('Imprenta')).toBe(
    '"Imprenta vía Grafo" <cotizaciones@grafo.test>',
  );
});

it('rechaza una respuesta de error de Resend y no simula envíos si falta la configuración', async () => {
  send.mockResolvedValue({ data: null, error: { message: 'fallo' } });
  await expect(new CorreoPresupuestoTransporte().enviar(datos)).rejects.toThrow(
    'no confirmó',
  );
  delete process.env.RESEND_API_KEY;
  await expect(new CorreoPresupuestoTransporte().enviar(datos)).rejects.toThrow(
    'no está configurado',
  );
  expect(send).toHaveBeenCalledTimes(1);
});

it('completa sólo las variables admitidas sin interpretar el contenido insertado', () => {
  expect(
    completarPlantilla('{cliente}: {empresa} / {presupuesto}', {
      cliente: '{empresa}',
      empresa: 'Grafo',
      presupuesto: 'PRES-1',
    }),
  ).toBe('{empresa}: Grafo / PRES-1');
});

it('valida destinatario, asunto sin cabeceras inyectadas y clave de idempotencia', async () => {
  const errores = await validate(
    plainToInstance(EnviarCorreoPresupuestoDto, {
      para: 'no-es-email',
      asunto: 'Hola\r\nBcc: otra@empresa.test',
      mensaje: 'Mensaje',
      idempotencia: 'invalida',
    }),
  );
  expect(errores.map((e) => e.property).sort()).toEqual([
    'asunto',
    'idempotencia',
    'para',
  ]);
});
