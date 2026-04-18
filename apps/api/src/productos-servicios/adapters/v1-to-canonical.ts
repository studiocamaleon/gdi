/**
 * A.6 — Adapter v1 → CotizacionCanonica.
 *
 * Toma el resultado de cualquiera de los 4 motores v1 actuales (digital,
 * talonario, rigidos, vinilo) y lo traduce a la shape canónica del modelo
 * universal (ver cotizacion-canonica.dto.ts).
 *
 * Responsabilidades:
 *   - Agregar los subtotales v1 en los 3 buckets del modelo universal.
 *   - Mapear bloques.procesos[] a pasos canónicos (1:1, solo con
 *     costoCentroCosto; los materiales quedan en el bucket global porque v1
 *     no los distribuye por paso).
 *   - Conservar la trazabilidad completa.
 *
 * Se usa durante Etapa C (shadow mode) para comparar v2 contra v1 expresados
 * en la misma shape, y durante Etapa D para que la UI unificada pueda leer
 * cotizaciones históricas v1 con el shape nuevo.
 */
import type {
  BucketsSubtotales,
  CotizacionCanonica,
  PasoCotizado,
} from '../dto/cotizacion-canonica.dto';

/**
 * Subtotales del shape v1 (unión de los campos que emiten los distintos motores).
 * Todos opcionales porque cada motor emite su subset.
 */
type V1Subtotales = {
  procesos?: number;
  papel?: number;
  material?: number;
  flexible?: number;
  tinta?: number;
  toner?: number;
  desgaste?: number;
  consumiblesTerminacion?: number;
  adicionalesMateriales?: number;
  adicionalesCostEffects?: number;
  papelExtra?: number;
  materialesExtra?: number;
  [key: string]: number | undefined;
};

type V1Bloque = {
  orden?: number;
  codigo?: string;
  nombre?: string;
  centroCostoId?: string;
  centroCostoNombre?: string;
  costo?: number;
  [key: string]: unknown;
};

type V1Resultado = {
  motorCodigo?: string;
  motorVersion?: number;
  periodo?: string;
  cantidad?: number;
  total?: number;
  unitario?: number;
  subtotales?: V1Subtotales;
  bloques?: {
    procesos?: V1Bloque[];
    materiales?: unknown[];
  };
  trazabilidad?: Record<string, unknown>;
  warnings?: string[];
  [key: string]: unknown;
};

/** Claves de subtotales v1 que NO van al bucket `materiasPrimas`. */
const EXCLUDED_FROM_MATERIASPRIMAS = new Set<keyof V1Subtotales>([
  'procesos',
  'adicionalesCostEffects',
]);

export function mapSubtotales(v1Subtotales: V1Subtotales | undefined): BucketsSubtotales {
  if (!v1Subtotales) return { centroCosto: 0, materiasPrimas: 0, cargosFlat: 0 };

  const centroCosto = Number(v1Subtotales.procesos ?? 0);
  const cargosFlat = Number(v1Subtotales.adicionalesCostEffects ?? 0);
  let materiasPrimas = 0;
  for (const [key, value] of Object.entries(v1Subtotales)) {
    if (EXCLUDED_FROM_MATERIASPRIMAS.has(key as keyof V1Subtotales)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) {
      materiasPrimas += value;
    }
  }
  return {
    centroCosto: roundMoney(centroCosto),
    materiasPrimas: roundMoney(materiasPrimas),
    cargosFlat: roundMoney(cargosFlat),
  };
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapBloqueToPaso(bloque: V1Bloque, index: number, motorCodigo: string): PasoCotizado {
  const id = String(bloque.codigo ?? `paso_${index + 1}`);
  return {
    id,
    tipo: `legacy:${motorCodigo}:${id}`,
    nombre: String(bloque.nombre ?? id),
    costoCentroCosto: roundMoney(Number(bloque.costo ?? 0)),
    costoMateriasPrimas: 0, // v1 no distribuye materiales por paso
    cargosFlat: 0,
    trazabilidad: {
      bloqueV1: bloque,
    },
  };
}

export function v1ToCanonical(resultado: V1Resultado): CotizacionCanonica {
  const motorCodigo = resultado.motorCodigo ?? 'desconocido';
  const bloqueProcesos = resultado.bloques?.procesos ?? [];
  const subtotales = mapSubtotales(resultado.subtotales);

  const pasos: PasoCotizado[] = bloqueProcesos.map((b, i) => mapBloqueToPaso(b, i, motorCodigo));

  return {
    motorCodigo: `adapter:v1→canonical:${motorCodigo}`,
    motorVersion: Number(resultado.motorVersion ?? 1),
    periodo: String(resultado.periodo ?? ''),
    cantidad: Number(resultado.cantidad ?? 0),
    total: roundMoney(Number(resultado.total ?? 0)),
    unitario: roundMoney(Number(resultado.unitario ?? 0)),
    subtotales,
    pasos,
    subProductos: [], // v1 no soporta productos componentes
    warnings: Array.isArray(resultado.warnings) ? resultado.warnings.map(String) : [],
    trazabilidad: {
      ...(resultado.trazabilidad ?? {}),
      // preservar bloques.materiales para consumers que lo necesiten
      materialesV1: resultado.bloques?.materiales ?? [],
      // guardar subtotales v1 originales por si hay que re-examinarlos
      subtotalesV1: resultado.subtotales ?? {},
    },
  };
}

/**
 * Valida coherencia del adapter: el total canónico debe coincidir con la
 * suma de los 3 buckets, y la suma de los 3 buckets debe ser ~igual al
 * total v1 (dentro de tolerancia de redondeo).
 *
 * Retorna los diffs si hay; array vacío si todo OK.
 */
export function validarConsistenciaAdapter(
  canonica: CotizacionCanonica,
  v1: V1Resultado,
  toleranciaPct = 0.01,
): string[] {
  const diffs: string[] = [];
  const sumaBuckets =
    canonica.subtotales.centroCosto +
    canonica.subtotales.materiasPrimas +
    canonica.subtotales.cargosFlat;
  const sumaBucketsRedondeada = roundMoney(sumaBuckets);
  const diffCanonicaVsBuckets = Math.abs(canonica.total - sumaBucketsRedondeada);
  if (diffCanonicaVsBuckets > 0.02) {
    diffs.push(
      `canonica.total (${canonica.total}) ≠ Σ subtotales (${sumaBucketsRedondeada}): diff ${diffCanonicaVsBuckets.toFixed(2)}`,
    );
  }
  const v1Total = Number(v1.total ?? 0);
  const diffVsV1 = v1Total > 0 ? Math.abs(canonica.total - v1Total) / v1Total : 0;
  if (diffVsV1 > toleranciaPct) {
    diffs.push(
      `canonica.total (${canonica.total}) difiere de v1.total (${v1Total}) en ${(diffVsV1 * 100).toFixed(3)}% (tolerancia ${toleranciaPct * 100}%)`,
    );
  }
  return diffs;
}
