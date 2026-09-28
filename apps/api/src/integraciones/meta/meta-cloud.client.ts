import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';

export type ResultadoMeta =
  | { estado: 'aceptada'; wamid: string }
  | { estado: 'fallida'; codigo: string }
  | { estado: 'incierta' };

@Injectable()
export class MetaCloudClient {
  /** Un único POST. Un timeout no permite saber si Meta ya envió el mensaje. */
  async enviarPlantilla(args: {
    accessToken: string;
    phoneNumberId: string;
    telefono: string;
    plantilla: string;
    idioma: string;
    parametros: string[];
    correlacion: string;
  }): Promise<ResultadoMeta> {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v26.0';
    const secret = process.env.META_APP_SECRET;
    if (
      !/^v\d+\.0$/.test(version) ||
      !/^\d+$/.test(args.phoneNumberId) ||
      !/^\+[1-9]\d{7,14}$/.test(args.telefono) ||
      !secret ||
      !args.accessToken
    ) {
      throw new Error('Configuración de Meta incompleta o inválida.');
    }
    // Host fijo y sin redirects: el Bearer no puede salir hacia otro servidor.
    const url = new URL(
      `https://graph.facebook.com/${version}/${args.phoneNumberId}/messages`,
    );
    url.searchParams.set(
      'appsecret_proof',
      createHmac('sha256', secret).update(args.accessToken).digest('hex'),
    );
    try {
      const response = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: args.telefono,
          type: 'template',
          biz_opaque_callback_data: args.correlacion,
          template: {
            name: args.plantilla,
            language: { code: args.idioma },
            ...(args.parametros.length
              ? {
                  components: [
                    {
                      type: 'body',
                      parameters: args.parametros.map((text) => ({
                        type: 'text',
                        text,
                      })),
                    },
                  ],
                }
              : {}),
          },
        }),
      });
      const body = (await response.json()) as {
        messages?: { id?: string }[];
        error?: { code?: number };
      };
      const wamid = body.messages?.[0]?.id;
      if (
        response.ok &&
        typeof wamid === 'string' &&
        wamid.startsWith('wamid.')
      )
        return { estado: 'aceptada', wamid };
      if (
        response.status >= 400 &&
        response.status < 500 &&
        Number.isInteger(body.error?.code)
      ) {
        return { estado: 'fallida', codigo: String(body.error!.code) };
      }
      // 5xx, respuestas incompletas o no-JSON: no repetir automáticamente.
      return { estado: 'incierta' };
    } catch {
      // Nunca conservar el error de fetch: puede contener URLs o credenciales.
      return { estado: 'incierta' };
    }
  }
}
