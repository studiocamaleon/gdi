import { rutaLog } from './ruta-log';

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
  const tipo = /^[A-Za-z][A-Za-z0-9_]{0,60}$/.test(error.name)
    ? error.name
    : 'Error';
  const codigo =
    'code' in error && /^P\d{4}$/.test(String(error.code))
      ? String(error.code)
      : undefined;
  // Prisma puede insertar parámetros y filas en Error.message/stack. Guardar
  // sólo ubicaciones de código; nunca el mensaje ni meta/cause del proveedor.
  const ubicaciones = error.stack
    ?.split('\n')
    .filter((linea) => /^\s+at [^\n]+:\d+:\d+\)?$/.test(linea))
    .slice(0, 5)
    .map((linea) => linea.trim().replace(process.cwd(), '[app]'));
  return { tipo, codigo, ubicaciones };
}
