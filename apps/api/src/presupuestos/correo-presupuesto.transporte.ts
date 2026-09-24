import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Resend } from 'resend';
import { adjuntosMarcaCorreo } from '../registro/plantillas/correo-base';
import { crearCorreoPresupuesto } from './correo-presupuesto.plantilla';

@Injectable()
export class CorreoPresupuestoTransporte {
  private readonly resend = process.env.RESEND_API_KEY
    ? new Resend(process.env.RESEND_API_KEY)
    : null;

  get disponible() {
    return Boolean(this.resend);
  }

  remitente(empresa: string) {
    const configurado =
      process.env.RESEND_PRESUPUESTOS_FROM ??
      'Grafoprint <cotizaciones@grafoprint.com.ar>';
    const direccion = configurado.match(/<([^<>]+)>/)?.[1] ?? configurado;
    const nombre = empresa
      .replace(/[<>"\r\n]/g, '')
      .trim()
      .slice(0, 100);
    return `"${nombre} vía Grafo" <${direccion}>`;
  }

  async enviar(
    datos: Parameters<typeof crearCorreoPresupuesto>[0] & {
      id: string;
      para: string;
      remitente: string;
      pdf: Buffer;
    },
  ) {
    if (!this.resend)
      throw new ServiceUnavailableException(
        'El servicio de correo no está configurado.',
      );
    const { data, error } = await this.resend.emails.send(
      {
        from: datos.remitente,
        to: datos.para,
        replyTo: datos.responderA,
        ...crearCorreoPresupuesto(datos),
        attachments: [
          ...adjuntosMarcaCorreo(),
          {
            filename: `${datos.numero.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
            content: datos.pdf,
            contentType: 'application/pdf',
          },
        ],
      },
      { idempotencyKey: `presupuesto-correo/${datos.id}` },
    );
    if (error || !data)
      throw new ServiceUnavailableException(
        'El servicio de correo no confirmó el envío. Podés reintentarlo desde el historial.',
      );
    return data.id;
  }
}
