/** Configuración mínima de herramientas locales; nunca copiar process.env
 * completo a procesadores de archivos. Esta reducción no es un sandbox: el
 * proceso conserva el usuario y los permisos de archivos del coordinador. */
const VARIABLES_PERMITIDAS = [
  'PATH',
  'SystemRoot',
  'WINDIR',
  'COMSPEC',
  'PATHEXT',
  'HOME',
  'USERPROFILE',
  'TMPDIR',
  'TMP',
  'TEMP',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
  'OMP_NUM_THREADS',
  'OPENBLAS_NUM_THREADS',
  'MKL_NUM_THREADS',
  'VECLIB_MAXIMUM_THREADS',
  'NUMEXPR_NUM_THREADS',
  'GRAFONEST_SELECTOR_THREADS',
  'GRAFONEST_SELECTOR_REDUCCION',
] as const;

export function entornoProcesoNativo(
  origen: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const entorno: NodeJS.ProcessEnv = {};
  for (const clave of VARIABLES_PERMITIDAS) {
    if (origen[clave] !== undefined) entorno[clave] = origen[clave];
  }
  return entorno;
}
