import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AplicarPrecioInput,
  AplicarPrecioOutput,
  DetalleFijadoPorCantidad,
  DetalleFijoConMargenVariable,
  DetalleMargenVariable,
  DetallePorMargen,
  DetallePrecioFijo,
  DetallePrecioFijoParaMargenMinimo,
  DetalleVariablePorCantidad,
  MetodoPrecio,
  PrecioConfig,
} from './aplicar-precio.types';

/**
 * Servicio principal del Tab Precio: aplica método de cálculo + impuestos +
 * comisiones a partir de un costo base, devuelve precio + desglose +
 * snapshots inmutables.
 *
 * Diseño:
 *   - Stateless. No toca DB. El caller (cotizador) prepara los inputs.
 *   - Pure function: mismos inputs → mismo output. Testeable a fondo.
 *   - El caller resuelve el override por cliente ANTES de llamar (decide
 *     qué `precioConfig` usar). Acá sólo se persiste el snapshot.
 *
 * Convenciones de cálculo:
 *   - Los porcentajes de margen son margen objetivo sobre el precio final,
 *     no recargo sobre costo.
 *   - Impuestos y comisiones se tratan como porcentajes del precio final,
 *     preservando la semántica comercial previa al refactor.
 *   - Para un margen m, impuestos i y comisiones c:
 *       precioFinal = costo / (1 - m - i - c)
 *   - Si la suma de porcentajes llega a 100%, el precio no es calculable.
 */
@Injectable()
export class AplicarPrecioService {
  private readonly logger = new Logger(AplicarPrecioService.name);

  aplicar(input: AplicarPrecioInput): AplicarPrecioOutput {
    this.validarInput(input);

    const totalComisionesPct = this.sumarPorcentajes(
      input.comisiones.map((c) => c.porcentaje),
    );
    const totalImpuestosPct = this.sumarPorcentajes(
      input.impuestos.map((i) => i.porcentaje),
    );

    const precioFinal = this.calcularPrecioFinal(
      input.precioConfig,
      input.costoUnitario,
      input.cantidad,
      totalImpuestosPct,
      totalComisionesPct,
    );

    const totalComisiones = redondear((precioFinal * totalComisionesPct) / 100);
    const totalImpuestos = redondear((precioFinal * totalImpuestosPct) / 100);
    const precioBase = redondear(
      precioFinal - totalComisiones - totalImpuestos,
    );
    const netoUnitario = redondear(precioFinal - totalImpuestos);
    const brutoUnitario = redondear(precioFinal);

    const precioNetoTotal = redondear(netoUnitario * input.cantidad);
    const precioBrutoTotal = redondear(brutoUnitario * input.cantidad);

    const margenEfectivoPct =
      brutoUnitario > 0
        ? redondear(((precioBase - input.costoUnitario) / brutoUnitario) * 100, 2)
        : 0;

    return {
      precioNetoUnitario: netoUnitario,
      precioBrutoUnitario: brutoUnitario,
      precioNetoTotal,
      precioBrutoTotal,
      desglose: {
        precioBase,
        totalImpuestos,
        totalComisiones,
        margenEfectivoPct,
      },
      snapshots: {
        precioConfig: input.precioConfig,
        impuestos: input.impuestos,
        comisiones: input.comisiones,
        precioEspecialCliente: input.precioEspecialCliente ?? null,
      },
    };
  }

  // ── Métodos de cálculo del precio base ──────────────────────────────

  private calcularPrecioFinal(
    config: PrecioConfig,
    costo: number,
    cantidad: number,
    impuestosPct: number,
    comisionesPct: number,
  ): number {
    switch (config.metodoCalculo) {
      case 'por_margen':
        return this.porMargen(
          config.detalle as unknown as DetallePorMargen,
          costo,
          impuestosPct,
          comisionesPct,
        );

      case 'precio_fijo':
        return this.precioFijo(config.detalle as unknown as DetallePrecioFijo);

      case 'precio_fijo_para_margen_minimo':
        return this.precioFijoParaMargenMinimo(
          config.detalle as unknown as DetallePrecioFijoParaMargenMinimo,
          costo,
          impuestosPct,
          comisionesPct,
        );

      case 'margen_variable':
        return this.margenVariable(
          config.detalle as unknown as DetalleMargenVariable,
          costo,
          cantidad,
          impuestosPct,
          comisionesPct,
        );

      case 'variable_por_cantidad':
        return this.variablePorCantidad(
          config.detalle as unknown as DetalleVariablePorCantidad,
          cantidad,
        );

      case 'fijado_por_cantidad':
        return this.fijadoPorCantidad(
          config.detalle as unknown as DetalleFijadoPorCantidad,
          cantidad,
        );

      case 'fijo_con_margen_variable':
        return this.fijoConMargenVariable(
          config.detalle as unknown as DetalleFijoConMargenVariable,
          costo,
          cantidad,
          impuestosPct,
          comisionesPct,
        );

      default:
        throw new BadRequestException(
          `Método de cálculo no soportado: ${config.metodoCalculo as string}`,
        );
    }
  }

  /** Precio final necesario para preservar margen objetivo. */
  private porMargen(
    detalle: DetallePorMargen,
    costo: number,
    impuestosPct: number,
    comisionesPct: number,
  ): number {
    if (typeof detalle.marginPct !== 'number') {
      throw new BadRequestException('por_margen requiere `marginPct`');
    }
    return this.precioDesdeMargenObjetivo(
      costo,
      detalle.marginPct,
      impuestosPct,
      comisionesPct,
    );
  }

  /** precio = price (config). */
  private precioFijo(detalle: DetallePrecioFijo): number {
    if (typeof detalle.price !== 'number') {
      throw new BadRequestException('precio_fijo requiere `price`');
    }
    return redondear(detalle.price);
  }

  /** precio = max(price, precio necesario para preservar margen mínimo). */
  private precioFijoParaMargenMinimo(
    detalle: DetallePrecioFijoParaMargenMinimo,
    costo: number,
    impuestosPct: number,
    comisionesPct: number,
  ): number {
    if (
      typeof detalle.price !== 'number' ||
      typeof detalle.minimumMarginPct !== 'number'
    ) {
      throw new BadRequestException(
        'precio_fijo_para_margen_minimo requiere `price` y `minimumMarginPct`',
      );
    }
    const piso = this.precioDesdeMargenObjetivo(
      costo,
      detalle.minimumMarginPct,
      impuestosPct,
      comisionesPct,
    );
    return redondear(Math.max(detalle.price, piso));
  }

  /** Tramos por rango: el primer `quantityUntil >= cantidad` define el margen. */
  private margenVariable(
    detalle: DetalleMargenVariable,
    costo: number,
    cantidad: number,
    impuestosPct: number,
    comisionesPct: number,
  ): number {
    if (!Array.isArray(detalle.tiers) || detalle.tiers.length === 0) {
      throw new BadRequestException(
        'margen_variable requiere `tiers` no vacío',
      );
    }
    // Ordenar por quantityUntil ascendente, defensivo
    const tiers = [...detalle.tiers].sort(
      (a, b) => a.quantityUntil - b.quantityUntil,
    );
    const tramo =
      tiers.find((t) => cantidad <= t.quantityUntil) ?? tiers[tiers.length - 1];
    return this.precioDesdeMargenObjetivo(
      costo,
      tramo.marginPct,
      impuestosPct,
      comisionesPct,
    );
  }

  /** Tramos por rango con precio fijo. */
  private variablePorCantidad(
    detalle: DetalleVariablePorCantidad,
    cantidad: number,
  ): number {
    if (!Array.isArray(detalle.tiers) || detalle.tiers.length === 0) {
      throw new BadRequestException(
        'variable_por_cantidad requiere `tiers` no vacío',
      );
    }
    const tiers = [...detalle.tiers].sort(
      (a, b) => a.quantityUntil - b.quantityUntil,
    );
    const tramo =
      tiers.find((t) => cantidad <= t.quantityUntil) ?? tiers[tiers.length - 1];
    return redondear(tramo.price);
  }

  /** Cantidades exactas: la cantidad pedida debe coincidir con uno de los tramos. */
  private fijadoPorCantidad(
    detalle: DetalleFijadoPorCantidad,
    cantidad: number,
  ): number {
    if (!Array.isArray(detalle.tiers) || detalle.tiers.length === 0) {
      throw new BadRequestException(
        'fijado_por_cantidad requiere `tiers` no vacío',
      );
    }
    const tramo = detalle.tiers.find((t) => t.quantity === cantidad);
    if (!tramo) {
      const cantidadesValidas = detalle.tiers.map((t) => t.quantity).join(', ');
      throw new BadRequestException(
        `fijado_por_cantidad: cantidad ${cantidad} no permitida. Válidas: ${cantidadesValidas}`,
      );
    }
    return redondear(tramo.price);
  }

  /** Cantidades exactas con margen objetivo sobre precio final. */
  private fijoConMargenVariable(
    detalle: DetalleFijoConMargenVariable,
    costo: number,
    cantidad: number,
    impuestosPct: number,
    comisionesPct: number,
  ): number {
    if (!Array.isArray(detalle.tiers) || detalle.tiers.length === 0) {
      throw new BadRequestException(
        'fijo_con_margen_variable requiere `tiers` no vacío',
      );
    }
    const tramo = detalle.tiers.find((t) => t.quantity === cantidad);
    if (!tramo) {
      const cantidadesValidas = detalle.tiers.map((t) => t.quantity).join(', ');
      throw new BadRequestException(
        `fijo_con_margen_variable: cantidad ${cantidad} no permitida. Válidas: ${cantidadesValidas}`,
      );
    }
    return this.precioDesdeMargenObjetivo(
      costo,
      tramo.marginPct,
      impuestosPct,
      comisionesPct,
    );
  }

  private precioDesdeMargenObjetivo(
    costo: number,
    margenPct: number,
    impuestosPct: number,
    comisionesPct: number,
  ): number {
    if (!Number.isFinite(margenPct) || margenPct < 0) {
      throw new BadRequestException('marginPct debe ser número >= 0');
    }
    const tasaTotal = (margenPct + impuestosPct + comisionesPct) / 100;
    if (tasaTotal >= 1) {
      throw new BadRequestException(
        'La suma de margen objetivo, impuestos y comisiones debe ser menor al 100% del precio final.',
      );
    }
    return redondear(costo / (1 - tasaTotal));
  }

  private sumarPorcentajes(valores: number[]): number {
    return valores.reduce((acc, val) => acc + val, 0);
  }

  // ── Validaciones ────────────────────────────────────────────────────

  private validarInput(input: AplicarPrecioInput): void {
    if (typeof input.costoUnitario !== 'number' || input.costoUnitario < 0) {
      throw new BadRequestException('costoUnitario debe ser número >= 0');
    }
    if (typeof input.cantidad !== 'number' || input.cantidad <= 0) {
      throw new BadRequestException('cantidad debe ser número > 0');
    }
    if (!input.precioConfig?.metodoCalculo) {
      throw new BadRequestException('precioConfig.metodoCalculo es requerido');
    }
    const metodosValidos: MetodoPrecio[] = [
      'por_margen',
      'precio_fijo',
      'precio_fijo_para_margen_minimo',
      'margen_variable',
      'fijado_por_cantidad',
      'fijo_con_margen_variable',
      'variable_por_cantidad',
    ];
    if (!metodosValidos.includes(input.precioConfig.metodoCalculo)) {
      throw new BadRequestException(
        `metodoCalculo inválido: ${input.precioConfig.metodoCalculo}`,
      );
    }
    // Porcentajes razonables
    for (const i of input.impuestos) {
      if (i.porcentaje < 0 || i.porcentaje > 100) {
        throw new BadRequestException(
          `Impuesto "${i.codigo}" con porcentaje fuera de [0,100]`,
        );
      }
    }
    for (const c of input.comisiones) {
      if (c.porcentaje < 0 || c.porcentaje > 100) {
        throw new BadRequestException(
          `Comisión "${c.codigo}" con porcentaje fuera de [0,100]`,
        );
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function redondear(n: number, decimales = 2): number {
  const factor = Math.pow(10, decimales);
  return Math.round(n * factor) / factor;
}
