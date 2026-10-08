/** Contrato compartido de telemetría: sólo metadatos técnicos permitidos. */
export type ConfigMonitoreo = {
  dsn: string;
  environment: 'staging' | 'production';
  release?: string;
};

export function configurarMonitoreo(
  env: Record<string, string | undefined>,
): ConfigMonitoreo | null {
  if (env.SENTRY_ENABLED !== 'true') return null;
  const environment =
    env.GRAFO_DEPLOY_ENV === 'production'
      ? 'production'
      : env.STAGING_PRIVATE === 'true' || env.GRAFO_DEPLOY_ENV === 'staging'
        ? 'staging'
        : null;
  if (!environment || !env.SENTRY_DSN) return null;
  try {
    const u = new URL(env.SENTRY_DSN);
    if (
      u.protocol !== 'https:' ||
      !/^o\d+\.ingest(?:\.(?:us|de))?\.sentry\.io$/.test(u.hostname) ||
      !/^[a-f0-9]{32}$/.test(u.username) ||
      u.password ||
      u.port ||
      !/^\/\d+$/.test(u.pathname) ||
      u.search ||
      u.hash
    )
      return null;
    const release = /^[a-f0-9]{40}$/.test(env.GRAFO_RELEASE ?? '')
      ? env.GRAFO_RELEASE
      : undefined;
    return { dsn: u.href, environment, release };
  } catch {
    return null;
  }
}

export const datosMinimos = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  frameContextLines: 0,
} as const;

const tipos = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
  'ApiError',
  'HttpException',
  'InternalServerErrorException',
  'ServiceUnavailableException',
  'PrismaClientKnownRequestError',
  'PrismaClientUnknownRequestError',
  'PrismaClientInitializationError',
  'PrismaClientRustPanicError',
]);
const areas = new Set([
  'auth',
  'session',
  'tenants',
  'clientes',
  'comercial',
  'ordenes-trabajo',
  'presupuestos',
  'centro-copiado',
  'productos-servicios',
  'archivos',
  'materiales',
  'maquinas',
  'centros-costo',
  'administracion',
  'reportes',
  'configuracion',
  'produccion',
  'inventario',
  'plataforma',
  'backoffice',
  'inbox',
  'whatsapp',
  'caja',
  'tesoreria',
  'cotizacion',
]);
export function areaMonitoreo(path: string): string {
  const area = path
    .split(/[?#]/, 1)[0]
    .replace(/^\/api(?:\/backend)?\//, '/')
    .split('/')
    .filter(Boolean)[0];
  return areas.has(area) ? area : 'aplicacion';
}

type Registro = Record<string, unknown>;
const objeto = (v: unknown): Registro =>
  v && typeof v === 'object' ? (v as Registro) : {};
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const codigoSeguro =
  /^(?:P\d{4}|E(?:CONNRESET|CONNREFUSED|TIMEDOUT|PIPE|NODATA|NOTFOUND))$/;
function archivoSeguro(value: unknown): string | undefined {
  if (typeof value !== 'string') return;
  const path = value.split(/[?#]/, 1)[0].replace(/\\/g, '/');
  // Nunca enviar rutas de archivos del cliente o del equipo del desarrollador.
  const match = path.match(
    /(?:^|\/)((?:_next\/static|\.next\/server)\/[^\s]+\.(?:js|mjs)|(?:dist\/)?src\/[^\s]+\.[cm]?[jt]sx?|node_modules\/[^\s]+\.[cm]?js)$/,
  );
  return match && !match[1].includes('..') ? match[1].slice(0, 300) : undefined;
}

/** Reconstruir, no redactar: una nueva propiedad del SDK no amplía los datos enviados. */
export function eventoMinimo(
  input: Registro,
  original?: unknown,
): Registro | null {
  if (input.type && input.type !== 'error') return null;
  const values = objeto(input.exception).values;
  if (!Array.isArray(values) || values.length === 0) return null;
  const tags: Record<string, string> = {};
  for (const [k, v] of Object.entries(objeto(input.tags))) {
    if (typeof v !== 'string') continue;
    if (['tenant_id', 'request_id', 'lote_id'].includes(k) && uuid.test(v)) tags[k] = v;
    if (k === 'area' && (areas.has(v) || v === 'aplicacion')) tags[k] = v;
    if (
      k === 'servicio' &&
      /^(web-cliente|web-servidor|api|worker|worker-pdf)$/.test(v)
    )
      tags[k] = v;
    if (k === 'operacion' && /^(http|render|inicio|cola|prueba)$/.test(v))
      tags[k] = v;
    if (
      k === 'cola' &&
      /^(cotizacion|geometria|planificacion|documentos-pdf|facturacion)$/.test(v)
    )
      tags[k] = v;
    if (k === 'etapa' && /^(emision|publicacion|worker)$/.test(v)) tags[k] = v;
    if (k === 'status' && /^5\d\d$/.test(v)) tags[k] = v;
    if (k === 'codigo' && codigoSeguro.test(v)) tags[k] = v;
  }
  // Un Error.message multilínea puede parecer un frame. Sólo aceptar ubicaciones
  // presentes DESPUÉS del mensaje original en el stack real del Error.
  let stackVerificado: string | undefined;
  if (original instanceof Error) {
    const cabecera = `${original.name}${original.message ? `: ${original.message}` : ''}`;
    stackVerificado = original.stack?.startsWith(cabecera)
      ? original.stack.slice(cabecera.length)
      : '';
  }
  const exceptions = values.slice(-3).map((value) => {
    const e = objeto(value),
      stack = objeto(e.stacktrace);
    const frames = Array.isArray(stack.frames)
      ? stack.frames.slice(-30).flatMap((value) => {
          const f = objeto(value),
            filename = archivoSeguro(f.filename);
          if (!filename) return [];
          if (
            stackVerificado !== undefined &&
            !stackVerificado.includes(
              `${String(f.filename)}:${String(f.lineno)}:${String(f.colno)}`,
            )
          )
            return [];
          return [
            {
              filename,
              ...(typeof f.function === 'string' &&
              /^[\w.$<> -]{1,150}$/.test(f.function)
                ? { function: f.function }
                : {}),
              ...(Number.isInteger(f.lineno) ? { lineno: f.lineno } : {}),
              ...(Number.isInteger(f.colno) ? { colno: f.colno } : {}),
              in_app: !filename.startsWith('node_modules/'),
            },
          ];
        })
      : [];
    const type =
      typeof e.type === 'string' && tipos.has(e.type) ? e.type : 'Error';
    return {
      type,
      value:
        tags.operacion === 'prueba'
          ? 'Prueba de monitoreo de Grafo (datos ficticios).'
          : 'Fallo de aplicación. Detalle privado omitido.',
      ...(frames.length ? { stacktrace: { frames } } : {}),
      mechanism: {
        type: 'generic',
        handled: objeto(e.mechanism).handled !== false,
      },
    };
  });
  return {
    ...(typeof input.event_id === 'string' &&
    /^[a-f0-9]{32}$/.test(input.event_id)
      ? { event_id: input.event_id }
      : {}),
    ...(typeof input.timestamp === 'number'
      ? { timestamp: input.timestamp }
      : {}),
    ...(input.environment === 'staging' || input.environment === 'production'
      ? { environment: input.environment }
      : {}),
    ...(typeof input.release === 'string' &&
    /^[a-f0-9]{40}$/.test(input.release)
      ? { release: input.release }
      : {}),
    platform: 'javascript',
    level: 'error',
    tags,
    exception: { values: exceptions },
    // Nunca permitir inferencia automática de IP ni payloads/request/breadcrumbs/extra/contextos.
    user: { ip_address: '0.0.0.0' },
  };
}
