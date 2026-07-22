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
  nombre: string;
  estado: string;
  idioma: string | null;
  categoria: string | null;
  cuerpo: string | null;
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
 * La forma exacta que devuelve Wati no está documentada del todo y varía
 * entre v1 y v3, así que se lee defensivamente: lo que no venga queda null y
 * la UI lo muestra como desconocido, en vez de romper el listado entero.
 */
function normalizarPlantilla(cruda: unknown): PlantillaRemota {
  const o = (cruda ?? {}) as Record<string, unknown>;
  const texto = (v: unknown): string | null =>
    typeof v === 'string' && v.trim() ? v.trim() : null;
  return {
    nombre: texto(o.elementName) ?? texto(o.name) ?? '(sin nombre)',
    estado: (texto(o.status) ?? 'DESCONOCIDO').toUpperCase(),
    idioma: texto(o.language) ?? texto(o.languageCode),
    categoria: texto(o.category),
    cuerpo: texto(o.body) ?? texto(o.bodyOriginal),
  };
}
