/**
 * Calculador de Precio del Tab Precio.
 *
 * Replica la lógica del Tab Precio del frontend (preservado en F.1.3) en el
 * backend, para poder devolver `precio` además de `costo` en el motor.
 *
 * Soporta los 7 métodos de cálculo:
 * - margen_variable: tramos por cantidad con margen variable
 * - por_margen: precio = costo × (1 + margen / 100)
 * - precio_fijo: precio definido manualmente
 * - fijado_por_cantidad: cantidades exactas con precio fijo
 * - fijo_con_margen_variable: cantidades exactas con margen variable
 * - variable_por_cantidad: rangos con precio fijo
 * - precio_fijo_para_margen_minimo: precio fijo + verifica margen mínimo
 *
 * Ver `docs/motor-por-pasos-analisis/fase-f/tab-precio-analysis.md`.
 */

export type MetodoCalculoPrecio =
  | 'margen_variable'
  | 'por_margen'
  | 'precio_fijo'
  | 'fijado_por_cantidad'
  | 'fijo_con_margen_variable'
  | 'variable_por_cantidad'
  | 'precio_fijo_para_margen_minimo';

export interface PrecioConfig {
  metodoCalculo: MetodoCalculoPrecio;
  detalle: Record<string, unknown>;
}

export interface ResultadoPrecio {
  metodoUsado: MetodoCalculoPrecio;
  precioUnitario: number;
  precioTotal: number;
  margenAplicadoPct?: number;
  /** Si el costo unitario excede el precio (margen negativo). */
  margenNegativo: boolean;
  /** Mensaje informativo para el comercial. */
  mensaje?: string;
}

interface TierCantidadPrecio {
  quantity: number;
  price: number;
}
interface TierCantidadMargen {
  quantity: number;
  marginPct: number;
}
interface TierRangoPrecio {
  quantityUntil: number;
  price: number;
}
interface TierRangoMargen {
  quantityUntil: number;
  marginPct: number;
}

export function calcularPrecio(
  costoUnitario: number,
  cantidad: number,
  config: PrecioConfig | null | undefined,
): ResultadoPrecio {
  if (!config) {
    // Sin config: precio = costo (margen 0%)
    return {
      metodoUsado: 'precio_fijo',
      precioUnitario: costoUnitario,
      precioTotal: costoUnitario * cantidad,
      margenAplicadoPct: 0,
      margenNegativo: false,
      mensaje: 'Sin config de precio: precio = costo',
    };
  }

  const detalle = config.detalle ?? {};

  if (config.metodoCalculo === 'por_margen') {
    const marginPct = Number(detalle.marginPct ?? 0);
    const precioUnitario = costoUnitario * (1 + marginPct / 100);
    return {
      metodoUsado: 'por_margen',
      precioUnitario,
      precioTotal: precioUnitario * cantidad,
      margenAplicadoPct: marginPct,
      margenNegativo: marginPct < 0,
    };
  }

  if (config.metodoCalculo === 'precio_fijo') {
    const precioUnitario = Number(detalle.price ?? 0);
    return {
      metodoUsado: 'precio_fijo',
      precioUnitario,
      precioTotal: precioUnitario * cantidad,
      margenNegativo: precioUnitario < costoUnitario,
    };
  }

  if (config.metodoCalculo === 'precio_fijo_para_margen_minimo') {
    const precioBase = Number(detalle.price ?? 0);
    const marginMinPct = Number(detalle.minimumMarginPct ?? 0);
    const precioMin = costoUnitario * (1 + marginMinPct / 100);
    const precioUnitario = Math.max(precioBase, precioMin);
    return {
      metodoUsado: 'precio_fijo_para_margen_minimo',
      precioUnitario,
      precioTotal: precioUnitario * cantidad,
      margenNegativo: false,
      mensaje:
        precioBase < precioMin
          ? `Precio ajustado a margen mínimo ${marginMinPct}% ($${precioMin.toFixed(2)})`
          : undefined,
    };
  }

  if (config.metodoCalculo === 'margen_variable') {
    const tiers = (detalle.tiers ?? []) as TierRangoMargen[];
    const tier = tiers.find((t) => cantidad <= t.quantityUntil) ?? tiers[tiers.length - 1];
    const marginPct = tier ? tier.marginPct : 0;
    const precioUnitario = costoUnitario * (1 + marginPct / 100);
    return {
      metodoUsado: 'margen_variable',
      precioUnitario,
      precioTotal: precioUnitario * cantidad,
      margenAplicadoPct: marginPct,
      margenNegativo: marginPct < 0,
    };
  }

  if (config.metodoCalculo === 'fijado_por_cantidad') {
    const tiers = (detalle.tiers ?? []) as TierCantidadPrecio[];
    const tier = tiers.find((t) => t.quantity === cantidad);
    if (!tier) {
      return {
        metodoUsado: 'fijado_por_cantidad',
        precioUnitario: 0,
        precioTotal: 0,
        margenNegativo: false,
        mensaje: `Cantidad ${cantidad} no está en las opciones (disponibles: ${tiers.map((t) => t.quantity).join(', ')})`,
      };
    }
    return {
      metodoUsado: 'fijado_por_cantidad',
      precioUnitario: tier.price,
      precioTotal: tier.price * cantidad,
      margenNegativo: tier.price < costoUnitario,
    };
  }

  if (config.metodoCalculo === 'fijo_con_margen_variable') {
    const tiers = (detalle.tiers ?? []) as TierCantidadMargen[];
    const tier = tiers.find((t) => t.quantity === cantidad);
    if (!tier) {
      return {
        metodoUsado: 'fijo_con_margen_variable',
        precioUnitario: 0,
        precioTotal: 0,
        margenNegativo: false,
        mensaje: `Cantidad ${cantidad} no está en las opciones`,
      };
    }
    const precioUnitario = costoUnitario * (1 + tier.marginPct / 100);
    return {
      metodoUsado: 'fijo_con_margen_variable',
      precioUnitario,
      precioTotal: precioUnitario * cantidad,
      margenAplicadoPct: tier.marginPct,
      margenNegativo: tier.marginPct < 0,
    };
  }

  if (config.metodoCalculo === 'variable_por_cantidad') {
    const tiers = (detalle.tiers ?? []) as TierRangoPrecio[];
    const tier = tiers.find((t) => cantidad <= t.quantityUntil) ?? tiers[tiers.length - 1];
    const precioUnitario = tier ? tier.price : 0;
    return {
      metodoUsado: 'variable_por_cantidad',
      precioUnitario,
      precioTotal: precioUnitario * cantidad,
      margenNegativo: precioUnitario < costoUnitario,
    };
  }

  return {
    metodoUsado: config.metodoCalculo,
    precioUnitario: costoUnitario,
    precioTotal: costoUnitario * cantidad,
    margenNegativo: false,
    mensaje: `Método ${config.metodoCalculo} no implementado`,
  };
}
