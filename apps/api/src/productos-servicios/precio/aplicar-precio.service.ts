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
 *   - **Comisiones** se aplican como % sobre el precio base (no sobre el
 *     costo). Esto preserva semántica del modelo viejo: comisiones son
 *     parte del costo financiero/comercial que el cliente paga.
 *   - **Impuestos** se aplican como % sobre (precio base + comisiones).
 *     IVA argentino: 21% sobre el subtotal con todo cargado.
 *   - Esto produce: bruto = base × (1 + comisiones%) × (1 + impuestos%).
 *     Si querés cambiar a régimen de impuestos sobre base sin comisiones,
 *     ajustar `aplicarImpuestos` (es 1 línea).
 *   - Margen mínimo se aplica al final: si el precio resultante no supera
 *     `costo × (1 + minimumMarginPct/100)`, se ajusta hacia arriba.
 */
@Injectable()
export class AplicarPrecioService {
  private readonly logger = new Logger(AplicarPrecioService.name);

  aplicar(input: AplicarPrecioInput): AplicarPrecioOutput {
    this.validarInput(input);

    // 1) Precio base = método de cálculo aplicado al costo
    const precioBase = this.calcularPrecioBase(
      input.precioConfig,
      input.costoUnitario,
      input.cantidad,
    );

    // 2) Comisiones (% sobre precio base)
    const totalComisionesPct = input.comisiones.reduce((acc, c) => acc + c.porcentaje, 0);
    const totalComisiones = redondear((precioBase * totalComisionesPct) / 100);
    const precioConComisiones = precioBase + totalComisiones;

    // 3) Impuestos (% sobre precio + comisiones)
    const totalImpuestosPct = input.impuestos.reduce((acc, i) => acc + i.porcentaje, 0);
    const totalImpuestos = redondear((precioConComisiones * totalImpuestosPct) / 100);

    // 4) Aplicar margen mínimo si el método lo declara
    const precioBaseConMinimo = this.aplicarMargenMinimo(
      input.precioConfig,
      input.costoUnitario,
      precioBase,
    );
    // Si margen mínimo elevó el base, recalcular comisiones/impuestos
    let netoUnitario = precioBaseConMinimo + totalComisiones;
    let brutoUnitario = netoUnitario + totalImpuestos;

    if (precioBaseConMinimo !== precioBase) {
      const nuevoTotComis = redondear((precioBaseConMinimo * totalComisionesPct) / 100);
      const nuevoConComis = precioBaseConMinimo + nuevoTotComis;
      const nuevoTotImp = redondear((nuevoConComis * totalImpuestosPct) / 100);
      netoUnitario = redondear(nuevoConComis);
      brutoUnitario = redondear(nuevoConComis + nuevoTotImp);
    }

    netoUnitario = redondear(netoUnitario);
    brutoUnitario = redondear(brutoUnitario);

    const precioNetoTotal = redondear(netoUnitario * input.cantidad);
    const precioBrutoTotal = redondear(brutoUnitario * input.cantidad);

    const margenEfectivoPct = input.costoUnitario > 0
      ? redondear(((precioBaseConMinimo - input.costoUnitario) / input.costoUnitario) * 100, 2)
      : 0;

    return {
      precioNetoUnitario: netoUnitario,
      precioBrutoUnitario: brutoUnitario,
      precioNetoTotal,
      precioBrutoTotal,
      desglose: {
        precioBase: redondear(precioBaseConMinimo),
        totalImpuestos:
          precioBaseConMinimo === precioBase
            ? totalImpuestos
            : redondear(((precioBaseConMinimo + (precioBaseConMinimo * totalComisionesPct) / 100) *
                totalImpuestosPct) /
                100),
        totalComisiones:
          precioBaseConMinimo === precioBase
            ? totalComisiones
            : redondear((precioBaseConMinimo * totalComisionesPct) / 100),
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

  private calcularPrecioBase(config: PrecioConfig, costo: number, cantidad: number): number {
    switch (config.metodoCalculo) {
      case 'por_margen':
        return this.porMargen(config.detalle as unknown as DetallePorMargen, costo);

      case 'precio_fijo':
        return this.precioFijo(config.detalle as unknown as DetallePrecioFijo);

      case 'precio_fijo_para_margen_minimo':
        return this.precioFijoParaMargenMinimo(
          config.detalle as unknown as DetallePrecioFijoParaMargenMinimo,
          costo,
        );

      case 'margen_variable':
        return this.margenVariable(
          config.detalle as unknown as DetalleMargenVariable,
          costo,
          cantidad,
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
        );

      default:
        throw new BadRequestException(
          `Método de cálculo no soportado: ${config.metodoCalculo as string}`,
        );
    }
  }

  /** precio = costo × (1 + margen/100). */
  private porMargen(detalle: DetallePorMargen, costo: number): number {
    if (typeof detalle.marginPct !== 'number') {
      throw new BadRequestException('por_margen requiere `marginPct`');
    }
    return redondear(costo * (1 + detalle.marginPct / 100));
  }

  /** precio = price (config). */
  private precioFijo(detalle: DetallePrecioFijo): number {
    if (typeof detalle.price !== 'number') {
      throw new BadRequestException('precio_fijo requiere `price`');
    }
    return redondear(detalle.price);
  }

  /** precio = max(price, costo × (1 + minimumMarginPct/100)). */
  private precioFijoParaMargenMinimo(
    detalle: DetallePrecioFijoParaMargenMinimo,
    costo: number,
  ): number {
    if (typeof detalle.price !== 'number' || typeof detalle.minimumMarginPct !== 'number') {
      throw new BadRequestException(
        'precio_fijo_para_margen_minimo requiere `price` y `minimumMarginPct`',
      );
    }
    const piso = costo * (1 + detalle.minimumMarginPct / 100);
    return redondear(Math.max(detalle.price, piso));
  }

  /** Tramos por rango: el primer `quantityUntil >= cantidad` define el margen. */
  private margenVariable(detalle: DetalleMargenVariable, costo: number, cantidad: number): number {
    if (!Array.isArray(detalle.tiers) || detalle.tiers.length === 0) {
      throw new BadRequestException('margen_variable requiere `tiers` no vacío');
    }
    // Ordenar por quantityUntil ascendente, defensivo
    const tiers = [...detalle.tiers].sort((a, b) => a.quantityUntil - b.quantityUntil);
    const tramo = tiers.find((t) => cantidad <= t.quantityUntil) ?? tiers[tiers.length - 1];
    return redondear(costo * (1 + tramo.marginPct / 100));
  }

  /** Tramos por rango con precio fijo. */
  private variablePorCantidad(detalle: DetalleVariablePorCantidad, cantidad: number): number {
    if (!Array.isArray(detalle.tiers) || detalle.tiers.length === 0) {
      throw new BadRequestException('variable_por_cantidad requiere `tiers` no vacío');
    }
    const tiers = [...detalle.tiers].sort((a, b) => a.quantityUntil - b.quantityUntil);
    const tramo = tiers.find((t) => cantidad <= t.quantityUntil) ?? tiers[tiers.length - 1];
    return redondear(tramo.price);
  }

  /** Cantidades exactas: la cantidad pedida debe coincidir con uno de los tramos. */
  private fijadoPorCantidad(detalle: DetalleFijadoPorCantidad, cantidad: number): number {
    if (!Array.isArray(detalle.tiers) || detalle.tiers.length === 0) {
      throw new BadRequestException('fijado_por_cantidad requiere `tiers` no vacío');
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

  /** Cantidades exactas con margen sobre costo. */
  private fijoConMargenVariable(
    detalle: DetalleFijoConMargenVariable,
    costo: number,
    cantidad: number,
  ): number {
    if (!Array.isArray(detalle.tiers) || detalle.tiers.length === 0) {
      throw new BadRequestException('fijo_con_margen_variable requiere `tiers` no vacío');
    }
    const tramo = detalle.tiers.find((t) => t.quantity === cantidad);
    if (!tramo) {
      const cantidadesValidas = detalle.tiers.map((t) => t.quantity).join(', ');
      throw new BadRequestException(
        `fijo_con_margen_variable: cantidad ${cantidad} no permitida. Válidas: ${cantidadesValidas}`,
      );
    }
    return redondear(costo * (1 + tramo.marginPct / 100));
  }

  // ── Margen mínimo (post-cálculo) ────────────────────────────────────

  private aplicarMargenMinimo(
    config: PrecioConfig,
    costo: number,
    precioBase: number,
  ): number {
    const min = (config.detalle as { minimumMarginPct?: unknown }).minimumMarginPct;
    if (typeof min !== 'number') return precioBase;
    const piso = costo * (1 + min / 100);
    return precioBase < piso ? piso : precioBase;
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
        throw new BadRequestException(`Impuesto "${i.codigo}" con porcentaje fuera de [0,100]`);
      }
    }
    for (const c of input.comisiones) {
      if (c.porcentaje < 0 || c.porcentaje > 100) {
        throw new BadRequestException(`Comisión "${c.codigo}" con porcentaje fuera de [0,100]`);
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function redondear(n: number, decimales = 2): number {
  const factor = Math.pow(10, decimales);
  return Math.round(n * factor) / factor;
}
