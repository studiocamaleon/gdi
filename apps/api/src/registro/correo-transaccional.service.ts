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
      html: `<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#18181b"><p style="font-size:13px;color:#71717a">GRAFOPRINT</p><h1 style="font-size:26px">Confirmá tu correo</h1><p>Hola ${esc(args.nombre)}. Falta un paso para crear el espacio de <strong>${esc(args.empresa)}</strong>.</p><p style="margin:28px 0"><a href="${args.url}" style="background:#18181b;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px">Confirmar y crear mi cuenta</a></p><p style="font-size:13px;color:#71717a">El enlace vence en 2 horas. Si no pediste esta cuenta, podés ignorar el mensaje.</p></div>`,
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
