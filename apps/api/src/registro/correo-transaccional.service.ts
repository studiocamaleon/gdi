import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Resend } from 'resend';
import {
  crearCorreoInvitacionEmpresa,
  type DatosInvitacionEmpresa,
} from './plantillas/invitacion-empresa';
import { adjuntosMarcaCorreo } from './plantillas/correo-base';
import {
  crearCorreoVerificacion,
  type DatosVerificacion,
} from './plantillas/verificacion';

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

  async enviarInvitacionEmpresa(
    args: DatosInvitacionEmpresa & { para: string },
    opciones: { prueba?: boolean; idempotencyKey?: string } = {},
  ) {
    if (!this.resend) {
      throw new ServiceUnavailableException(
        'El envío de invitaciones por correo no está configurado.',
      );
    }
    const { data, error } = await this.resend.emails.send(
      {
        from:
          process.env.RESEND_FROM ?? 'Grafoprint <registro@grafoprint.com.ar>',
        to: args.para,
        replyTo: process.env.RESEND_REPLY_TO,
        ...crearCorreoInvitacionEmpresa(args, opciones),
        attachments: adjuntosMarcaCorreo(),
      },
      { idempotencyKey: opciones.idempotencyKey },
    );
    if (error || !data) {
      throw new ServiceUnavailableException(
        'No pudimos enviar la invitación por correo.',
      );
    }
    return data;
  }

  async enviarVerificacion(
    args: DatosVerificacion & { para: string },
    opciones: { prueba?: boolean; idempotencyKey?: string } = {},
  ) {
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
    const { data, error } = await this.resend.emails.send(
      {
        from,
        to: args.para,
        replyTo: process.env.RESEND_REPLY_TO,
        ...crearCorreoVerificacion(args, opciones),
        attachments: adjuntosMarcaCorreo(),
      },
      { idempotencyKey: opciones.idempotencyKey },
    );
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
