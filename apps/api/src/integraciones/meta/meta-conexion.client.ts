import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { MetaConexionConfig } from './meta-conexion.config';

type Json = Record<string, unknown>;
const objeto = (x: unknown): Json =>
  x !== null && typeof x === 'object' && !Array.isArray(x) ? (x as Json) : {};
const idValido = (x: unknown): x is string =>
  typeof x === 'string' && /^\d+$/.test(x);
const permisos = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
];

/** Sólo códigos propios: jamás conservar errores, URLs ni cuerpos de Meta. */
export class ErrorConexionMeta extends Error {
  constructor(
    readonly motivo:
      | 'RESPUESTA_INCIERTA'
      | 'AUTORIZACION_RECHAZADA'
      | 'TOKEN_INVALIDO'
      | 'PERMISOS_INSUFICIENTES'
      | 'ACTIVO_NO_AUTORIZADO'
      | 'NUMERO_AMBIGUO'
      | 'SIN_COEXISTENCIA'
      | 'DATOS_INVALIDOS',
  ) {
    super(motivo);
  }
}

export type ActivosMetaVerificados = {
  wabaId: string;
  phoneNumberId: string;
  numero: string;
  nombreVerificado: string | null;
  tokenVenceEl: Date | null;
  accesoDatosVenceEl: Date | null;
};

function vencimiento(value: unknown, opcional = false): Date | null {
  if (opcional && value === undefined) return null;
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > 8.64e12 ||
    (value !== 0 && value * 1000 <= Date.now())
  )
    throw new ErrorConexionMeta('TOKEN_INVALIDO');
  return value === 0 ? null : new Date(value * 1000);
}

@Injectable()
export class MetaConexionClient {
  private url(config: MetaConexionConfig, path: string) {
    if (
      !idValido(config.appId) ||
      !config.appSecret ||
      !/^v\d+\.0$/.test(config.graphVersion)
    )
      throw new ErrorConexionMeta('DATOS_INVALIDOS');
    return new URL(`https://graph.facebook.com/${config.graphVersion}/${path}`);
  }

  private async leer(url: URL, token?: string): Promise<Json> {
    try {
      const res = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(12_000),
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: 'no-store',
      });
      const json = objeto(await res.json());
      if (res.status >= 400 && res.status < 500 && res.status !== 429)
        throw new ErrorConexionMeta('AUTORIZACION_RECHAZADA');
      if (!res.ok || json.error)
        throw new ErrorConexionMeta('RESPUESTA_INCIERTA');
      return json;
    } catch (error) {
      if (error instanceof ErrorConexionMeta) throw error;
      // fetch puede incluir la URL secreta en el error. No propagar su cause.
      throw new ErrorConexionMeta('RESPUESTA_INCIERTA');
    }
  }

  /** El código vence a los 30 s. Canjear sin esperar el evento de activos.
   * Un solo intento: un timeout puede haber consumido el código en Meta. */
  async canjear(config: MetaConexionConfig, codigo: string): Promise<string> {
    if (!codigo || codigo.length > 16_384)
      throw new ErrorConexionMeta('DATOS_INVALIDOS');
    const url = this.url(config, 'oauth/access_token');
    url.searchParams.set('client_id', config.appId);
    url.searchParams.set('client_secret', config.appSecret);
    url.searchParams.set('code', codigo);
    const body = await this.leer(url);
    if (typeof body.access_token !== 'string' || !body.access_token)
      throw new ErrorConexionMeta('RESPUESTA_INCIERTA');
    return body.access_token;
  }

  private async consultar(
    config: MetaConexionConfig,
    token: string,
    path: string,
    params: Record<string, string>,
  ) {
    const url = this.url(config, path);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    url.searchParams.set(
      'appsecret_proof',
      createHmac('sha256', config.appSecret).update(token).digest('hex'),
    );
    return this.leer(url, token);
  }

  async verificar(
    config: MetaConexionConfig,
    token: string,
    seleccion: { wabaId: string; phoneNumberId?: string },
  ): Promise<ActivosMetaVerificados> {
    if (
      !token ||
      !idValido(seleccion.wabaId) ||
      (seleccion.phoneNumberId !== undefined &&
        !idValido(seleccion.phoneNumberId))
    )
      throw new ErrorConexionMeta('DATOS_INVALIDOS');
    const debugUrl = this.url(config, 'debug_token');
    debugUrl.searchParams.set('input_token', token);
    const debug = objeto(
      (await this.leer(debugUrl, `${config.appId}|${config.appSecret}`)).data,
    );
    if (debug.is_valid !== true || debug.app_id !== config.appId)
      throw new ErrorConexionMeta('TOKEN_INVALIDO');
    const tokenVenceEl = vencimiento(debug.expires_at);
    const accesoDatosVenceEl = vencimiento(debug.data_access_expires_at, true);
    const scopes = Array.isArray(debug.scopes) ? debug.scopes : [];
    if (!permisos.every((scope) => scopes.includes(scope)))
      throw new ErrorConexionMeta('PERMISOS_INSUFICIENTES');
    // Sin target_ids significa acceso general según Graph. Si Meta limita
    // destinos, la cuenta elegida tiene que estar expresamente incluida.
    const granulares = Array.isArray(debug.granular_scopes)
      ? debug.granular_scopes.map(objeto)
      : [];
    for (const scope of permisos) {
      const limites = granulares.filter((g) => g.scope === scope);
      if (
        limites.length &&
        !limites.some(
          (g) =>
            g.target_ids === undefined ||
            g.target_ids === null ||
            (Array.isArray(g.target_ids) &&
              g.target_ids.some(
                (id) =>
                  (typeof id === 'string' ||
                    (typeof id === 'number' && Number.isSafeInteger(id))) &&
                  String(id) === seleccion.wabaId,
              )),
        )
      )
        throw new ErrorConexionMeta('ACTIVO_NO_AUTORIZADO');
    }
    // No basta un ID recibido del navegador: comprobar su pertenencia por
    // el edge de la cuenta con ESTE token. Nunca seguir paging.next (URL libre).
    let after: string | undefined;
    const vistos = new Set<string>();
    const numeros = new Map<string, Json>();
    for (let pagina = 0; pagina < 5; pagina++) {
      const body = await this.consultar(
        config,
        token,
        `${seleccion.wabaId}/phone_numbers`,
        {
          fields: 'id,display_phone_number,verified_name',
          limit: '100',
          ...(after ? { after } : {}),
        },
      );
      if (!Array.isArray(body.data))
        throw new ErrorConexionMeta('RESPUESTA_INCIERTA');
      for (const raw of body.data) {
        const n = objeto(raw);
        if (!idValido(n.id)) throw new ErrorConexionMeta('RESPUESTA_INCIERTA');
        numeros.set(n.id, n);
      }
      if (seleccion.phoneNumberId && numeros.has(seleccion.phoneNumberId))
        break;
      if (!seleccion.phoneNumberId && numeros.size > 1)
        throw new ErrorConexionMeta('NUMERO_AMBIGUO');
      const paging = objeto(body.paging);
      if (!paging.next) break;
      const cursor = objeto(paging.cursors).after;
      if (
        typeof cursor !== 'string' ||
        !cursor ||
        vistos.has(cursor) ||
        pagina === 4
      )
        throw new ErrorConexionMeta('RESPUESTA_INCIERTA');
      vistos.add(cursor);
      after = cursor;
    }
    const phoneNumberId =
      seleccion.phoneNumberId ??
      (numeros.size === 1 ? [...numeros.keys()][0] : undefined);
    const numero = phoneNumberId ? numeros.get(phoneNumberId) : undefined;
    if (!phoneNumberId || !numero)
      throw new ErrorConexionMeta('ACTIVO_NO_AUTORIZADO');
    const detalle = await this.consultar(config, token, phoneNumberId, {
      fields: 'id,is_on_biz_app,platform_type',
    });
    if (
      detalle.id !== phoneNumberId ||
      detalle.is_on_biz_app !== true ||
      detalle.platform_type !== 'CLOUD_API'
    )
      throw new ErrorConexionMeta('SIN_COEXISTENCIA');
    const telefono =
      typeof numero.display_phone_number === 'string'
        ? numero.display_phone_number.replace(/[\s()+.-]/g, '')
        : '';
    if (!/^[1-9]\d{7,14}$/.test(telefono))
      throw new ErrorConexionMeta('DATOS_INVALIDOS');
    return {
      wabaId: seleccion.wabaId,
      phoneNumberId,
      numero: `+${telefono}`,
      nombreVerificado:
        typeof numero.verified_name === 'string' ? numero.verified_name : null,
      tokenVenceEl,
      accesoDatosVenceEl,
    };
  }
}
