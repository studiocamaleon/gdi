/**
 * A.6 — Shape canónica del resultado de cotización (modelo universal).
 *
 * Referencia: quiero-que-hablemos-de-dynamic-parrot.md §7
 *
 * Esta es la estructura que todos los motores v2 deben emitir y que toda la
 * UI del frontend consumirá tras la migración. Es un shape con:
 *
 *   - total / unitario
 *   - 3 buckets agregados: centroCosto, materiasPrimas, cargosFlat
 *   - lista de pasos activos con su desglose + trazabilidad
 *   - sub-productos (cotizaciones recursivas para productos componentes)
 *
 * Intencionalmente similar (pero más general) a la shape v1 de los motores
 * digital/talonario/rigidos/vinilo para facilitar mapeo vía adapter.
 */

export type BucketsSubtotales = {
  /** Σ costoCentroCosto de todos los pasos activos */
  centroCosto: number;
  /** Σ costoMateriasPrimas de todos los pasos activos */
  materiasPrimas: number;
  /** Σ cargosFlat (tercerizaciones, royalties, viáticos, mínimos, etc.) */
  cargosFlat: number;
};

export type PasoCotizado = {
  id: string;
  /** Código de familia (ver pasos/familias.ts) o 'legacy:<motor>:<bloque>' si viene del adapter v1 */
  tipo: string;
  nombre: string;
  /** Output del paso: 3 componentes de costo */
  costoCentroCosto: number;
  costoMateriasPrimas: number;
  cargosFlat: number;
  /**
   * Trazabilidad opcional con detalle del cálculo: tiempos por tramo,
   * consumos de material, inputs leídos, outputs emitidos, fórmula usada.
   * El shape concreto depende de la familia del paso.
   */
  trazabilidad?: Record<string, unknown>;
};

export type CotizacionCanonica = {
  /** Código del motor (v2) que produjo la cotización, o 'adapter:v1→canonical' si viene del adapter. */
  motorCodigo: string;
  motorVersion: number;
  /** Periodo tarifario aplicado. */
  periodo: string;
  /** Cantidad pedida del producto. */
  cantidad: number;

  /** Precio total del trabajo (suma de los 3 buckets). */
  total: number;
  /** Precio por unidad comercial (total / cantidad, redondeado). */
  unitario: number;

  /** Breakdown agregado por bucket. Σ subtotales = total. */
  subtotales: BucketsSubtotales;

  /** Lista ordenada de pasos que se ejecutaron (o se mapean del v1). */
  pasos: PasoCotizado[];

  /**
   * Cotizaciones recursivas de productos componentes consumidos como
   * material por algún paso. Vacío en el shape adaptado desde v1.
   */
  subProductos: CotizacionCanonica[];

  /** Advertencias no bloqueantes (ej. "sin tarifa para centro X en período Y"). */
  warnings: string[];

  /**
   * Trazabilidad global del cálculo (imposición, nesting, matching aplicado,
   * config usada, etc.). Conservada como-está desde v1 para no perder info.
   */
  trazabilidad?: Record<string, unknown>;
};
