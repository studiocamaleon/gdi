import { rutaLog } from './ruta-log';

const TIPOS_ERROR = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
  'AbortError',
  'TimeoutError',
  'PrismaClientKnownRequestError',
  'PrismaClientUnknownRequestError',
  'PrismaClientValidationError',
  'PrismaClientInitializationError',
  'PrismaClientRustPanicError',
  'HttpException',
  'BadRequestException',
  'UnauthorizedException',
  'ForbiddenException',
  'NotFoundException',
  'ConflictException',
  'ServiceUnavailableException',
  'InternalServerErrorException',
]);

/** Lista positiva: cabeceras, cuerpos, respuestas y errores pueden traer claves. */
export function solicitudParaLog(req: Record<string, unknown>) {
  return {
    id: req.id,
    method: req.method,
    url: rutaLog(typeof req.url === 'string' ? req.url : ''),
    remoteAddress: req.remoteAddress,
  };
}
export function respuestaParaLog(res: Record<string, unknown>) {
  return { statusCode: res.statusCode };
}
export function errorParaLog(error: unknown) {
  if (!(error instanceof Error)) return { tipo: 'ErrorDesconocido' };
  const tipo = TIPOS_ERROR.has(error.name) ? error.name : 'Error';
  const codigo =
    'code' in error && /^P\d{4}$/.test(String(error.code))
      ? String(error.code)
      : undefined;
  // Prisma puede insertar parámetros y filas en Error.message/stack. Guardar
  // sólo ubicaciones de código; nunca el mensaje ni meta/cause del proveedor.
  const cabecera = `${error.name}${error.message ? `: ${error.message}` : ''}`;
  // Error.message puede contener saltos de línea que parecen frames. Retirar
  // todo el mensaje antes de seleccionar ubicaciones, también si es multilínea.
  const stack = error.stack?.startsWith(cabecera)
    ? error.stack.slice(cabecera.length)
    : undefined;
  const ubicaciones = stack
    ?.split('\n')
    .filter((linea) => /^\s+at [^\n]+:\d+:\d+\)?$/.test(linea))
    .slice(0, 5)
    .map((linea) => linea.trim().replace(process.cwd(), '[app]'));
  return { tipo, codigo, ubicaciones };
}

/** Para Logger de Nest y textos de diagnóstico: nunca interpolar el error crudo. */
export function textoErrorLog(error: unknown): string {
  return JSON.stringify(errorParaLog(error));
}
