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

/** Base sobre la que se calcula el % del impuesto. */
export type ImpuestoBaseCalculo = 'NETO' | 'BRUTO_COBRADO';
/**
 * POR_FUERA: se agrega al neto y se discrimina al cliente (IVA).
 * POR_DENTRO: costo embebido en el neto vía gross-up (IIBB, imp. al cheque).
 */
export type ImpuestoTraslado = 'POR_FUERA' | 'POR_DENTRO';

export interface ImpuestoSnapshot {
  catalogoId: string;
  codigo: string;
  nombre: string;
  porcentaje: number;
  orden: number;
  /** Default NETO (compat con snapshots previos al modelo por base). */
  baseCalculo?: ImpuestoBaseCalculo;
  /** Default POR_DENTRO (compat con snapshots previos al modelo por base). */
  traslado?: ImpuestoTraslado;
  desglosarCliente?: boolean;
}

export interface ComisionSnapshot {
  catalogoId: string;
  codigo: string;
  nombre: string;
  porcentaje: number;
  orden: number;
  /**
   * NETO (default): comisión de vendedor, % sobre el precio sin IVA.
   * BRUTO_COBRADO: comisión de pasarela de pago/tarjeta, % sobre lo cobrado
   * (incluye IVA) — se convierte a equivalente-neto igual que el imp. al cheque.
   */
  baseCalculo?: ImpuestoBaseCalculo;
}

export interface PrecioEspecialClienteSnapshot {
  precioEspecialId: string;
  clienteId: string;
  config: PrecioConfig;
}

/** Descuento comercial de la línea. Se aplica sobre el NETO de lista. */
export interface DescuentoPrecio {
  tipo: 'PORCENTAJE' | 'MONTO';
  /**
   * Si `PORCENTAJE`: porcentaje 0–100 sobre el neto de lista.
   * Si `MONTO`: monto en $ sobre el NETO TOTAL de la línea (se prorratea por
   * unidad). Nunca deja el neto por debajo de 0.
   */
  valor: number;
}

export interface AplicarPrecioInput {
  /** Costo unitario comercial del producto, ya devuelto por el motor universal. */
  costoUnitario: number;
  /** Cantidad comercial — necesaria para los métodos escalonados. */
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
  /**
   * A cuántos decimales redondea el dinero de la salida. Lo decide el
   * tenant: los de la moneda (2 en ARS, 0 en CLP) o 0 si eligió redondear
   * a la unidad (`redondeoPrecio = 'entero'`). Default 2 = lo de siempre.
   */
  decimalesPrecio?: number;
  /**
   * Descuento comercial de la línea. Se aplica sobre el neto de lista (antes
   * del IVA); impuestos, comisiones y margen se recomputan sobre el neto ya
   * descontado. El costo es fijo, así que el descuento sale del margen (puede
   * volverlo negativo — el control por umbral vive aguas arriba, no acá).
   */
  descuento?: DescuentoPrecio | null;
}

export interface DesglosePrecio {
  /** Porción del neto que queda para la empresa: neto − costos impositivos internos − comisiones. */
  precioBase: number;
  /**
   * Suma monetaria de TODOS los impuestos (por fuera + internos), por unidad.
   * Los por fuera (IVA) además son la diferencia bruto − neto.
   */
  totalImpuestos: number;
  /** Suma de comisiones aplicadas (% sobre el neto), por unidad. */
  totalComisiones: number;
  /** Margen efectivo logrado: (precioBase − costo) / neto × 100. */
  margenEfectivoPct: number;
}

export interface AplicarPrecioOutput {
  /** Precio NETO fiscal unitario (base imponible del IVA; sin impuestos por fuera). */
  precioNetoUnitario: number;
  /** Precio bruto unitario = neto + impuestos por fuera (total factura). */
  precioBrutoUnitario: number;
  /** Precio neto total (× cantidad). */
  precioNetoTotal: number;
  /** Precio bruto total (× cantidad). */
  precioBrutoTotal: number;
  /** Desglose de cómo se compuso el precio. */
  desglose: DesglosePrecio;
  /** Efecto del descuento comercial (montos en 0 si no hubo). */
  descuento: {
    aplicado: boolean;
    /** $ descontado por unidad. */
    montoUnitario: number;
    /** $ descontado en la línea (× cantidad). */
    montoTotal: number;
    /** Neto de LISTA (antes del descuento), unitario y total. */
    netoListaUnitario: number;
    netoListaTotal: number;
  };
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
