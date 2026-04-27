/**
 * Tipos del módulo de aplicación de precio.
 *
 * Espejo del Tab Precio del modelo viejo, normalizado al nuevo schema:
 *   - método de cálculo (7 métodos polimórficos en `detalle`)
 *   - impuestos aplicados (referencias a catálogo)
 *   - comisiones aplicadas (referencias a catálogo)
 *   - override por cliente (opcional)
 *
 * Snapshot inmutable: lo que devuelve `aplicarPrecio` es la base del
 * `*SnapshotJson` que se persiste en `CotizacionItem` al cotizar.
 */

export type MetodoPrecio =
  | 'por_margen'
  | 'precio_fijo'
  | 'precio_fijo_para_margen_minimo'
  | 'margen_variable'
  | 'fijado_por_cantidad'
  | 'fijo_con_margen_variable'
  | 'variable_por_cantidad';

export interface PrecioConfig {
  metodoCalculo: MetodoPrecio;
  detalle: Record<string, unknown>;
}

// ── Tramos (para los métodos escalonados) ──────────────────────────

/** Tramo "hasta N → margen X%" (margen_variable) */
export interface TramoRangoMargen {
  quantityUntil: number;
  marginPct: number;
}

/** Tramo "hasta N → precio $Y" (variable_por_cantidad) */
export interface TramoRangoPrecio {
  quantityUntil: number;
  price: number;
}

/** Tramo "cantidad exacta N → precio $Y" (fijado_por_cantidad) */
export interface TramoCantidadExactaPrecio {
  quantity: number;
  price: number;
}

/** Tramo "cantidad exacta N → margen X%" (fijo_con_margen_variable) */
export interface TramoCantidadExactaMargen {
  quantity: number;
  marginPct: number;
}

// ── Detalle por método (lo que va en `PrecioConfig.detalle`) ────────

export interface DetallePorMargen {
  marginPct: number;
  minimumMarginPct?: number;
}
export interface DetallePrecioFijo {
  price: number;
  minimumPrice?: number;
}
export interface DetallePrecioFijoParaMargenMinimo {
  price: number;
  minimumPrice?: number;
  minimumMarginPct: number;
}
export interface DetalleMargenVariable {
  tiers: TramoRangoMargen[];
}
export interface DetalleVariablePorCantidad {
  tiers: TramoRangoPrecio[];
}
export interface DetalleFijadoPorCantidad {
  tiers: TramoCantidadExactaPrecio[];
}
export interface DetalleFijoConMargenVariable {
  tiers: TramoCantidadExactaMargen[];
}

// ── Inputs / Outputs del servicio ───────────────────────────────────

export interface ImpuestoSnapshot {
  catalogoId: string;
  codigo: string;
  nombre: string;
  porcentaje: number;
  orden: number;
}

export interface ComisionSnapshot {
  catalogoId: string;
  codigo: string;
  nombre: string;
  porcentaje: number;
  orden: number;
}

export interface PrecioEspecialClienteSnapshot {
  precioEspecialId: string;
  clienteId: string;
  config: PrecioConfig;
}

export interface AplicarPrecioInput {
  /** Costo unitario del producto, ya devuelto por el motor universal. */
  costoUnitario: number;
  /** Cantidad pedida — necesaria para los métodos escalonados. */
  cantidad: number;
  /** Configuración de precio del producto (o del override de cliente, si aplica). */
  precioConfig: PrecioConfig;
  /** Lista de impuestos a aplicar (snapshot del catálogo + orden). */
  impuestos: ImpuestoSnapshot[];
  /** Lista de comisiones a aplicar. */
  comisiones: ComisionSnapshot[];
  /**
   * Si el cliente tiene precio especial, se pasa para que el snapshot lo
   * registre y `precioConfig` ya viene siendo el del override.
   * El service no resuelve el override — el caller debe hacerlo y pasar
   * acá `precioConfig` ya correcto.
   */
  precioEspecialCliente?: PrecioEspecialClienteSnapshot;
}

export interface DesglosePrecio {
  /** Precio base salido del método de cálculo (sin impuestos ni comisiones). */
  precioBase: number;
  /** Suma de impuestos aplicados (en unidades monetarias). */
  totalImpuestos: number;
  /** Suma de comisiones aplicadas. */
  totalComisiones: number;
  /** Margen efectivo logrado (% sobre el costo). */
  margenEfectivoPct: number;
}

export interface AplicarPrecioOutput {
  /** Precio neto unitario (precioBase + comisiones — sin impuestos). */
  precioNetoUnitario: number;
  /** Precio bruto unitario (precioBase + comisiones + impuestos). */
  precioBrutoUnitario: number;
  /** Precio neto total (× cantidad). */
  precioNetoTotal: number;
  /** Precio bruto total (× cantidad). */
  precioBrutoTotal: number;
  /** Desglose de cómo se compuso el precio. */
  desglose: DesglosePrecio;
  /**
   * Snapshots para persistir en CotizacionItem. Inmutables.
   * Si en el futuro cambian los catálogos, la cotización mantiene esto.
   */
  snapshots: {
    precioConfig: PrecioConfig;
    impuestos: ImpuestoSnapshot[];
    comisiones: ComisionSnapshot[];
    precioEspecialCliente: PrecioEspecialClienteSnapshot | null;
  };
}
