/**
 * Qué campos son "la plata" — lo que sólo ve quien tiene
 * `finanzas.ver_margenes`.
 *
 * La lista es EXPLÍCITA y no un prefijo, y eso no es prolijidad: el motor tiene
 * `margenesNoImprimiblesMm`, `margenNoUsableMm` y `margenNoImprimibleMm`, que
 * son márgenes FÍSICOS en milímetros —la zona que la máquina no puede imprimir—
 * y no tienen nada que ver con la ganancia. Podarlos por parecerse en el nombre
 * rompería el nesting y el cálculo del pliego, en silencio y sólo para algunos
 * usuarios, que es la peor forma de romper algo.
 *
 * Ver docs/usuarios-roles-permisos-diseno.md
 */

/** Costos: lo que a la imprenta le sale producirlo. */
const COSTOS = [
  'costo',
  'costos',
  'costoTotal',
  'costoUnitario',
  'costoEstimado',
  'costoSeparado',
  'costoConsolidado',
  'costoMaquina',
  'costoManoObra',
  'costoMateriales',
  'costoProveedor',
  'costoTotalReal',
  'costoCobrar',
  'costoMensualTotal',
  'costosVariables',
  'costosFijos',
  'costoPorUnidad',
  'costoEstimadoMm2',
];

/** Márgenes y contribución: la ganancia, en plata o en puntos. */
const GANANCIA = [
  'margen',
  'margenBruto',
  'margenBrutoPct',
  'margenBrutoPts',
  'margenBrutoDeltaPts',
  'margenPct',
  'margenPctMin',
  'margenAplicadoPct',
  'margenEfectivoPct',
  'margenNegativo',
  'margenClientes',
  'contribucion',
  'contribucionPct',
  'contribucionPts',
  'contribucionDeltaPts',
  'rentabilidad',
  'utilidad',
  'ganancia',
];

/** Lo que pagamos nosotros: el precio del otro lado del mostrador. */
const COMPRA = ['precioCompra', 'precioProveedor', 'costoProveedorUnitario'];

export const CAMPOS_DE_PLATA = new Set<string>([
  ...COSTOS,
  ...GANANCIA,
  ...COMPRA,
]);

/**
 * Campos que se PARECEN pero son geometría. Están acá para que el test los
 * defienda: si alguien "mejora" la lista con un prefijo, el test se cae.
 */
export const FALSOS_AMIGOS = [
  'margenesNoImprimiblesMm',
  'margenNoImprimibleMm',
  'margenNoImprimible',
  'margenNoUsableMm',
  'margenSuperiorMm',
  'margenInferiorMm',
];

/**
 * Devuelve el valor sin los campos de plata, recursivamente.
 *
 * Los campos se BORRAN en vez de ponerse en cero: un cero es un dato y se
 * suma, se promedia y termina en un reporte que dice que la imprenta trabaja
 * sin costos. Ausente es ausente.
 */
export function podarPlata<T>(valor: T): T {
  return podar(valor) as T;
}

function podar(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(podar);
  if (valor === null || typeof valor !== 'object') return valor;
  // Date, Decimal y compañía: se devuelven tal cual. Recorrer sus internos las
  // rompería, y no son contenedores de campos nuestros.
  if (valor.constructor !== Object) return valor;

  const salida: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
    if (CAMPOS_DE_PLATA.has(clave)) continue;
    salida[clave] = podar(v);
  }
  return salida;
}
