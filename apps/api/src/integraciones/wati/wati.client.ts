import { Injectable, Logger } from '@nestjs/common';

/**
 * Cliente HTTP de Wati.
 *
 * Dos rarezas de su API que hay que absorber acá para que no se filtren al
 * resto del sistema:
 *
 *  1. El identificador del tenant va en el PATH, no en un header:
 *     `https://live-mt-server.wati.io/{tenantId}/api/...`
 *  2. Las operaciones están repartidas entre dos versiones. Crear un template
 *     es v1 (`/api/v1/...`) y enviarlo es v3 (`/api/ext/v3/...`). No es
 *     prolijo, pero es lo que hay.
 *
 * Ver docs/integraciones-wati-diseno.md §1
 */

/** Timeout de toda llamada saliente. Un tercero lento no puede colgarnos. */
const TIMEOUT_MS = 10_000;

export type CredencialesWati = {
  /** `https://live-mt-server.wati.io` — sin el tenant id. */
  endpoint: string;
  /** El "Client ID" del dashboard de Wati. */
  tenantId: string;
  /** Bearer token, sin el prefijo "Bearer ". */
  token: string;
};

export type ResultadoConexion =
  | { ok: true; templates: number; numero?: string | null }
  | { ok: false; motivo: string };

export type PlantillaRemota = {
  /** Id de Wati. Sirve para consultar el estado después de crearla. */
  id: string | null;
  /** `elementName`: el nombre con el que se la invoca al enviar. */
  nombre: string;
  estado: string;
  idioma: string | null;
  categoria: string | null;
  /** Cuerpo POSICIONAL, tal como lo ve Meta: "Hola {{1}}". */
  cuerpo: string | null;
  /** Cuerpo NOMBRADO, como se autoreó en Wati: "Hola {{name}}". */
  cuerpoNombrado: string | null;
  /**
   * Parámetros declarados, EN ORDEN. La posición en este array es el número
   * que aparece en `cuerpo`: el primero es {{1}}.
   */
  parametros: string[];
  /** Señal de calidad de Meta. Un template puede pausarse por bajarla. */
  calidad: string | null;
  /** Fijo, sin variables. Grafo pone el mismo en todas las suyas. */
  footer: string | null;
};

@Injectable()
export class WatiClient {
  private readonly logger = new Logger(WatiClient.name);

  /**
   * Comprueba que las credenciales sirven, pidiendo los templates.
   *
   * Se elige ese endpoint y no un ping cualquiera porque valida las tres
   * cosas de una —endpoint, tenant y token— y además devuelve justo lo que
   * F2 va a necesitar. Nunca lanza: un error de conexión es información para
   * mostrar, no una excepción que rompa la pantalla de configuración.
   */
  async probar(cred: CredencialesWati): Promise<ResultadoConexion> {
    try {
      const plantillas = await this.listarPlantillas(cred);
      return { ok: true, templates: plantillas.length };
    } catch (error) {
      return { ok: false, motivo: mensajeDeError(error) };
    }
  }

  async listarPlantillas(cred: CredencialesWati): Promise<PlantillaRemota[]> {
    const json = await this.pedir<{ messageTemplates?: unknown[] }>(
      cred,
      'GET',
      '/api/v1/getMessageTemplates',
    );
    const crudas = Array.isArray(json?.messageTemplates)
      ? json.messageTemplates
      : [];
    return crudas.map((t) => normalizarPlantilla(t));
  }

  /**
   * Envía una plantilla a UN número.
   *
   * Los parámetros se mandan **por nombre**, no por posición: Wati los
   * resuelve contra el cuerpo nombrado. Por eso `mapearParametros` es
   * imprescindible — nosotros calculamos los valores por posición (el {{1}}
   * es el nombre del cliente, el {{2}} el número de orden) y necesitamos
   * saber con qué nombre viaja cada uno.
   *
   * `broadcastName` es lo que Wati muestra en su propio panel para agrupar
   * envíos. Se manda algo identificable para que el tenant pueda auditar
   * desde el lado de Wati qué salió de Grafo.
   */
  async enviarPlantilla(
    cred: CredencialesWati,
    envio: {
      /** E.164 sin `+`. Ver `aE164`. */
      telefono: string;
      plantilla: string;
      /** `{ nombre_del_parametro: valor }`. */
      parametros: Record<string, string>;
      broadcastName?: string;
    },
  ): Promise<{ ok: true; id: string | null } | { ok: false; motivo: string }> {
    try {
      const json = await this.pedir<{
        result?: boolean;
        info?: string;
        validWhatsAppNumber?: boolean;
        message?: unknown;
      }>(
        cred,
        'POST',
        `/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(envio.telefono)}`,
        {
          template_name: envio.plantilla,
          broadcast_name: envio.broadcastName ?? `grafo_${envio.plantilla}`,
          parameters: Object.entries(envio.parametros).map(([name, value]) => ({
            name,
            value,
          })),
        },
      );

      // Wati responde 200 con `result: false` cuando rechaza el envío: la
      // plantilla no existe, el número no tiene WhatsApp, falta un parámetro.
      // Sin este chequeo un envío fallido pasa por exitoso.
      if (json?.result === false) {
        return {
          ok: false,
          motivo:
            typeof json.info === 'string' && json.info.trim()
              ? json.info.trim()
              : 'Wati rechazó el envío sin dar motivo.',
        };
      }
      const msg = (json?.message ?? {}) as Record<string, unknown>;
      const id = typeof msg.id === 'string' ? msg.id : null;
      return { ok: true, id };
    } catch (error) {
      return { ok: false, motivo: mensajeDeError(error) };
    }
  }

  // ── Interno ─────────────────────────────────────────────────────────

  private async pedir<T>(
    cred: CredencialesWati,
    metodo: 'GET' | 'POST' | 'DELETE',
    ruta: string,
    cuerpo?: unknown,
  ): Promise<T> {
    const url = `${baseDe(cred)}${ruta}`;
    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        method: metodo,
        headers: {
          Authorization: `Bearer ${cred.token}`,
          'Content-Type': 'application/json',
        },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      // Red, DNS o timeout: no hay respuesta que interpretar.
      throw new ErrorWati(
        error instanceof Error && error.name === 'TimeoutError'
          ? `Wati no respondió en ${TIMEOUT_MS / 1000} segundos.`
          : 'No se pudo conectar con Wati. Revisá el endpoint.',
        0,
      );
    }

    const texto = await respuesta.text();
    if (!respuesta.ok) {
      throw new ErrorWati(
        interpretar(respuesta.status, texto),
        respuesta.status,
      );
    }
    try {
      return JSON.parse(texto) as T;
    } catch {
      throw new ErrorWati(
        'Wati devolvió una respuesta que no es JSON. Revisá el endpoint.',
        respuesta.status,
      );
    }
  }
}

export class ErrorWati extends Error {
  constructor(
    mensaje: string,
    readonly status: number,
  ) {
    super(mensaje);
    this.name = 'ErrorWati';
  }
}

/**
 * Base con el tenant en el path.
 *
 * Tolera que el usuario pegue el endpoint con el tenant id ya incluido, que
 * es lo que muestra el dashboard de Wati y por lo tanto lo que va a pasar la
 * mitad de las veces. Sin esto la URL saldría duplicada
 * (`.../313754/313754/api/...`) y el error sería un 404 incomprensible.
 */
export function baseDe(cred: CredencialesWati): string {
  const limpio = cred.endpoint.trim().replace(/\/+$/, '');
  const tenant = cred.tenantId.trim();
  return limpio.endsWith(`/${tenant}`) ? limpio : `${limpio}/${tenant}`;
}

/**
 * El token viaja en un header: por HTTP plano lo lee cualquiera en el camino.
 * Se permite `http` SÓLO contra localhost, que es la única forma de probar el
 * flujo entero contra un Wati simulado sin montar TLS.
 */
export function exigirHttps(endpoint: string): string | null {
  const url = endpoint.trim();
  if (url.startsWith('https://')) return null;
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
  if (local && process.env.NODE_ENV !== 'production') return null;
  return 'El endpoint tiene que ser https: el token viaja en la cabecera y por HTTP plano queda expuesto.';
}

/** Traduce el status a algo que el usuario pueda accionar. */
function interpretar(status: number, texto: string): string {
  if (status === 401 || status === 403) {
    return 'Wati rechazó el token. Generá uno nuevo en el dashboard (API Docs) y volvé a pegarlo.';
  }
  if (status === 404) {
    return 'Wati devolvió 404. Suele ser el Tenant ID equivocado o un endpoint de otra región.';
  }
  if (status === 429) {
    return 'Wati está limitando las llamadas (429). Esperá unos minutos.';
  }
  if (status >= 500) {
    return `Wati tuvo un error interno (${status}).`;
  }
  return `Wati respondió ${status}: ${texto.slice(0, 200)}`;
}

function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorWati) return error.message;
  return error instanceof Error ? error.message : String(error);
}

/**
 * Normaliza lo que devuelve Wati, cuyos campos NO son los que sugiere su
 * documentación. Verificado contra una cuenta real (2026-07-22):
 *
 *  - `language` es un OBJETO `{key, value, text}`, no un string.
 *  - Hay DOS cuerpos: `body` con variables posicionales ({{1}}), que es lo
 *    que ve Meta, y `bodyOriginal` con las nombradas ({{name}}), que es como
 *    se escribió en Wati.
 *
 * Lo que no venga queda en null: una plantilla rara no puede romper el
 * listado entero.
 */
function normalizarPlantilla(cruda: unknown): PlantillaRemota {
  const o = (cruda ?? {}) as Record<string, unknown>;
  const texto = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : null;

  // `language` viene como objeto; se busca el código (es_AR) y no la etiqueta.
  const lang = o.language;
  const idioma =
    texto(lang) ??
    (lang && typeof lang === 'object'
      ? texto((lang as Record<string, unknown>).value)
      : null);

  const params = mapearParametros(texto(o.body), texto(o.bodyOriginal));

  return {
    id: texto(o.id),
    nombre: texto(o.elementName) ?? texto(o.name) ?? '(sin nombre)',
    estado: (texto(o.status) ?? 'DESCONOCIDO').toUpperCase(),
    idioma,
    categoria: texto(o.category),
    cuerpo: texto(o.body),
    cuerpoNombrado: texto(o.bodyOriginal),
    parametros: params,
    calidad: texto(o.quality),
    footer: texto(o.footer),
  };
}

/**
 * Qué nombre le corresponde a cada posición.
 *
 * OJO: NO se puede usar el orden de `customParams`. Verificado contra una
 * cuenta real — en `nueva_orden_v4`, customParams viene
 * [nombre_cliente, fecha_entrega, …, numero_orden] pero el cuerpo dice
 * "¡Hola {{1}}! Tu orden #{{2}}" y ese {{2}} es `numero_orden`, el SÉPTIMO
 * de la lista. Además `customParams` arrastra basura de autoría (parámetros
 * llamados "1" que no aparecen en ningún lado).
 *
 * La única fuente confiable es alinear los dos cuerpos: la k-ésima variable
 * de `bodyOriginal` es la k-ésima de `body`. Mandar los parámetros en el
 * orden equivocado no falla — Meta acepta el envío y al cliente le llega su
 * número de orden donde va el nombre.
 */
export function mapearParametros(
  cuerpo: string | null,
  cuerpoNombrado: string | null,
): string[] {
  if (!cuerpo || !cuerpoNombrado) return [];
  const posiciones = cuerpo.match(/\{\{\s*(\d+)\s*\}\}/g) ?? [];
  const nombres = cuerpoNombrado.match(/\{\{\s*([^}]+?)\s*\}\}/g) ?? [];
  if (posiciones.length !== nombres.length) return [];

  const porNumero = new Map<number, string>();
  posiciones.forEach((p, i) => {
    const n = Number(p.replace(/[^\d]/g, ''));
    const nombre = nombres[i].replace(/^\{\{\s*|\s*\}\}$/g, '');
    // Una variable puede repetirse; vale la primera aparición.
    if (!porNumero.has(n)) porNumero.set(n, nombre);
  });

  const max = Math.max(0, ...porNumero.keys());
  return Array.from(
    { length: max },
    (_, i) => porNumero.get(i + 1) ?? `param${i + 1}`,
  );
}
