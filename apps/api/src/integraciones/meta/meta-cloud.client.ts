import type { ComponenteEnvioPlantilla } from '../../common/inbox/plantillas';
import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';

export type ResultadoMeta =
  | { estado: 'aceptada'; wamid: string }
  | { estado: 'fallida'; codigo: string }
  | { estado: 'incierta' };

@Injectable()
export class MetaCloudClient {
  /** La subida no envía un mensaje. Sólo devuelve un ID de media de este número. */
  async subirArchivo(args: {
    accessToken: string;
    phoneNumberId: string;
    bytes: Buffer;
    mime: string;
    nombre: string;
  }): Promise<string> {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v26.0',
      secret = process.env.META_APP_SECRET;
    const limite =
      args.mime === 'application/pdf'
        ? 20_000_000
        : ['image/png', 'image/jpeg'].includes(args.mime)
          ? 5_000_000
          : 0;
    if (
      !/^v\d+\.0$/.test(version) ||
      !/^\d+$/.test(args.phoneNumberId) ||
      !secret ||
      !args.accessToken ||
      !args.bytes.length ||
      args.bytes.length > limite
    )
      throw new Error('Archivo no compatible.');
    const url = new URL(
      `https://graph.facebook.com/${version}/${args.phoneNumberId}/media`,
    );
    url.searchParams.set(
      'appsecret_proof',
      createHmac('sha256', secret).update(args.accessToken).digest('hex'),
    );
    const form = new FormData();
    form.set('messaging_product', 'whatsapp');
    form.set('type', args.mime);
    form.set(
      'file',
      new Blob([new Uint8Array(args.bytes)], { type: args.mime }),
      args.nombre,
    );
    try {
      const r = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${args.accessToken}` },
        body: form,
      });
      const body = (await r.json()) as { id?: unknown };
      if (!r.ok || typeof body.id !== 'string' || !/^\d{1,80}$/.test(body.id))
        throw new Error();
      return body.id;
    } catch {
      throw new Error('No se pudo preparar el archivo en Meta.');
    }
  }
  /** Un único POST. Un timeout no permite saber si Meta ya envió el mensaje. */
  async enviarPlantilla(args: {
    accessToken: string;
    phoneNumberId: string;
    telefono: string;
    plantilla: string;
    idioma: string;
    parametros: string[];
    componentes?: ComponenteEnvioPlantilla[];
    correlacion: string;
  }): Promise<ResultadoMeta> {
    return this.enviar(args, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: args.telefono,
      type: 'template',
      biz_opaque_callback_data: args.correlacion,
      template: {
        name: args.plantilla,
        language: { code: args.idioma },
        ...(args.componentes?.length
          ? { components: args.componentes }
          : args.parametros.length
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
    });
  }

  /** Siempre consulta la WABA del canal; sólo usa el cursor, nunca paging.next. */
  async listarPlantillas(args: {
    accessToken: string;
    wabaId: string;
    despues?: string | null;
  }) {
    const version = process.env.META_GRAPH_API_VERSION ?? 'v26.0';
    const secret = process.env.META_APP_SECRET;
    if (
      !/^v\d+\.0$/.test(version) ||
      !/^\d+$/.test(args.wabaId) ||
      !secret ||
      !args.accessToken ||
      (args.despues?.length ?? 0) > 2048
    )
      throw new Error('No se pudo consultar el catálogo de Meta.');
    const url = new URL(
      `https://graph.facebook.com/${version}/${args.wabaId}/message_templates`,
    );
    url.searchParams.set(
      'fields',
      'id,name,language,category,status,parameter_format,components',
    );
    url.searchParams.set('limit', '100');
    if (args.despues) url.searchParams.set('after', args.despues);
    url.searchParams.set(
      'appsecret_proof',
      createHmac('sha256', secret).update(args.accessToken).digest('hex'),
    );
    try {
      const response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
        headers: { Authorization: `Bearer ${args.accessToken}` },
      });
      const body = (await response.json()) as {
        data?: unknown[];
        paging?: { next?: unknown; cursors?: { after?: unknown } };
      };
      if (!response.ok || !Array.isArray(body.data) || body.data.length > 100)
        throw new Error();
      const after = body.paging?.cursors?.after;
      if (
        body.paging?.next &&
        (typeof after !== 'string' || !after || after.length > 2048)
      )
        throw new Error();
      return {
        data: body.data,
        siguiente: body.paging?.next ? (after as string) : null,
      };
    } catch {
      throw new Error('No se pudo consultar el catálogo de Meta.');
    }
  }

  async enviarTexto(args: {
    accessToken: string;
    phoneNumberId: string;
    telefono: string;
    texto: string;
    correlacion: string;
  }): Promise<ResultadoMeta> {
    if (!args.texto.trim() || args.texto.length > 4096)
      throw new Error('Texto inválido.');
    return this.enviar(args, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: args.telefono,
      type: 'text',
      biz_opaque_callback_data: args.correlacion,
      text: { body: args.texto, preview_url: false },
    });
  }
  private async enviar(
    args: { accessToken: string; phoneNumberId: string; telefono: string },
    payload: Record<string, unknown>,
  ): Promise<ResultadoMeta> {
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
        body: JSON.stringify(payload),
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
