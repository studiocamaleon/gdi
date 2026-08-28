import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class CorreoTransaccionalService {
  private readonly logger = new Logger(CorreoTransaccionalService.name);
  private readonly resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  constructor() {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.REGISTRO_PUBLICO_HABILITADO === 'true' &&
      !this.resend
    ) {
      throw new Error(
        'REGISTRO_PUBLICO_HABILITADO requiere RESEND_API_KEY en producción.',
      );
    }
  }

  async enviarVerificacion(args: {
    para: string;
    nombre: string;
    empresa: string;
    url: string;
  }) {
    if (!this.resend) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(
          'El correo de verificación no está configurado.',
        );
      }
      this.logger.warn(`[DEV] Verificación de ${args.para}: ${args.url}`);
      return { id: 'dev-local' };
    }

    const from =
      process.env.RESEND_FROM ?? 'Grafoprint <registro@grafoprint.com.ar>';
    const { data, error } = await this.resend.emails.send({
      from,
      to: args.para,
      replyTo: process.env.RESEND_REPLY_TO,
      subject: 'Confirmá tu cuenta de Grafoprint',
      text: `Hola ${args.nombre}. Confirmá el correo para crear el espacio de ${args.empresa}: ${args.url}. El enlace vence en 2 horas.`,
      html: crearHtmlVerificacion(args),
    });
    if (error || !data) {
      this.logger.error(
        `Resend rechazó el envío a ${args.para}: ${error?.message}`,
      );
      throw new ServiceUnavailableException(
        'No pudimos enviar el correo de verificación. Intentá nuevamente.',
      );
    }
    return data;
  }
}

function crearHtmlVerificacion(args: {
  nombre: string;
  empresa: string;
  url: string;
}) {
  const nombre = esc(args.nombre);
  const empresa = esc(args.empresa);
  const url = esc(args.url);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>Confirmá tu cuenta de Grafoprint</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f1ec;color:#14141a;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Tu espacio de trabajo está a un paso de quedar listo.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f3f1ec;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
            <tr>
              <td style="padding:0 4px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <span style="display:inline-block;width:12px;height:12px;margin-right:8px;border-radius:4px;background:#ff6a2b;vertical-align:1px;"></span>
                      <span style="font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#14141a;">grafoprint</span>
                    </td>
                    <td align="right" style="font-size:11px;letter-spacing:1.4px;color:#92929b;text-transform:uppercase;">Gráfica digital inteligente</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="overflow:hidden;border:1px solid #e5e2db;border-radius:20px;background:#ffffff;box-shadow:0 12px 36px rgba(20,20,26,0.06);">
                <div style="height:5px;background:#ff6a2b;font-size:0;line-height:0;">&nbsp;</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="padding:46px 48px 42px;">
                      <div style="display:inline-block;margin-bottom:20px;padding:6px 10px;border-radius:999px;background:#fff1e9;color:#c2410c;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;">Activación de cuenta</div>
                      <h1 style="margin:0 0 16px;font-size:34px;line-height:1.12;letter-spacing:-1.1px;color:#14141a;">Tu gráfica está a un paso<br>de trabajar más conectada.</h1>
                      <p style="margin:0;font-size:16px;line-height:1.7;color:#5f5f68;">Hola <strong style="color:#2c2c33;">${nombre}</strong>. Confirmá tu correo para terminar de crear el espacio de trabajo de tu imprenta.</p>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 30px;border:1px solid #eeebe4;border-radius:14px;background:#fafaf9;">
                        <tr>
                          <td style="padding:17px 19px;">
                            <div style="margin-bottom:4px;font-size:10px;font-weight:700;letter-spacing:1.1px;color:#92929b;text-transform:uppercase;">Espacio de trabajo</div>
                            <div style="font-size:17px;font-weight:650;letter-spacing:-0.2px;color:#14141a;">${empresa}</div>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td align="center" bgcolor="#14141a" style="border-radius:12px;">
                            <a href="${url}" style="display:inline-block;padding:15px 23px;color:#ffffff;font-size:15px;font-weight:650;line-height:1;text-decoration:none;">Confirmar y crear mi cuenta&nbsp;&nbsp;→</a>
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px;border-top:1px solid #eeebe4;">
                        <tr>
                          <td style="padding-top:23px;font-size:13px;line-height:1.55;color:#777780;">
                            <strong style="color:#2c2c33;">14 días para probar Grafoprint.</strong><br>
                            Sin tarjeta y con todas las funciones del plan que elegiste.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 18px 0;text-align:center;font-size:12px;line-height:1.6;color:#85858e;">
                Este enlace vence en 2 horas. Si no solicitaste esta cuenta, podés ignorar el mensaje.<br>
                Si el botón no funciona, copiá este enlace en tu navegador:<br>
                <a href="${url}" style="color:#5f5f68;text-decoration:underline;word-break:break-all;">${url}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 18px 0;text-align:center;font-size:11px;letter-spacing:0.2px;color:#a0a0a7;">
                © Grafoprint · GRUPO IDEA SAS
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function esc(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char] ?? char,
  );
}
