import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  AplicarPrecioInput,
  AplicarPrecioOutput,
  DescuentoPrecio,
  DetalleFijadoPorCantidad,
  DetalleFijoConMargenVariable,
  DetalleMargenVariable,
  DetallePorMargen,
  DetallePrecioFijo,
  DetallePrecioFijoParaMargenMinimo,
  DetalleVariablePorCantidad,
  ImpuestoSnapshot,
  MetodoPrecio,
  PrecioConfig,
} from './aplicar-precio.types';

/**
 * Cargas impositivas/comerciales normalizadas para el cálculo.
 * Ver docs de `ImpuestoBaseCalculo` / `ImpuestoTraslado`.
 */
interface CargasNormalizadas {
  /** % de impuestos POR_FUERA (IVA): se agregan al neto y se discriminan. */
  porFueraPct: number;
  /** % de costos POR_DENTRO con base NETO (IIBB). */
  internosNetoPct: number;
  /** % de costos POR_DENTRO con base BRUTO_COBRADO (imp. al cheque). */
  internosBrutoPct: number;
  /** % de comisiones con base NETO (vendedor). */
  comisionesNetoPct: number;
  /** % de comisiones con base BRUTO_COBRADO (pasarela de pago/tarjeta). */
  comisionesBrutoPct: number;
  /** 1 + porFueraPct/100 — factor neto→bruto. */
  factorPorFuera: number;
  /**
   * Carga interna total expresada como % del NETO, para el gross-up:
   * (internosNeto + comisionesNeto) + (internosBruto + comisionesBruto)×factorPorFuera.
   */
  cargaInternaNetoPct: number;
}

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
 * Modelo de cálculo (normativa AR, rediseño 2026-07-08):
 *   - El PRECIO NETO es la base: margen y costos internos se definen sobre él.
 *   - Impuestos POR_FUERA (IVA): se AGREGAN al neto y se discriminan.
 *       bruto = neto × (1 + iva%)
 *   - Impuestos POR_DENTRO (IIBB, cheque): son costos reales de la empresa,
 *     se embeben en el neto vía gross-up. IIBB usa base NETO; el impuesto al
 *     cheque usa base BRUTO_COBRADO (lo acreditado incluye IVA), por lo que su
 *     % se convierte a equivalente-neto multiplicando por (1 + iva%).
 *   - Comisiones: costos embebidos igual que los impuestos internos. Base NETO
 *     (vendedor) o BRUTO_COBRADO (pasarela de pago: su % aplica sobre lo
 *     cobrado con IVA, se convierte a equivalente-neto ×(1+iva%)).
 *   - Para margen m, costos internos ci y comisiones c (todos % del neto):
 *       neto  = costo / (1 − m − ci − c)
 *       bruto = neto × (1 + iva%)
 *   - Métodos de precio fijo: `detalle.precioIncluyeIva` (default true) define
 *     si el precio configurado es el total factura (se divide por 1+iva%) o
 *     directamente el neto.
 *   - Si la suma de porcentajes sobre el neto llega a 100%, no es calculable.
 */
@Injectable()
export class AplicarPrecioService {
  private readonly logger = new Logger(AplicarPrecioService.name);

  /**
   * Decimales del dinero de ESTA corrida (los % siguen redondeando a 2).
   * Campo de instancia y no parámetro enhebrado: `aplicar()` es síncrono de
   * punta a punta, así que no hay carrera posible entre requests.
   */
  private dec = 2;
  private r = (n: number) => redondear(n, this.dec);

  aplicar(input: AplicarPrecioInput): AplicarPrecioOutput {
    this.validarInput(input);
    this.dec = input.decimalesPrecio ?? 2;

    const cargas = this.normalizarCargas(input.impuestos, input.comisiones);

    const netoLista = this.calcularNeto(
      input.precioConfig,
      input.costoUnitario,
      input.cantidad,
      cargas,
    );

    // Descuento comercial: sale del neto de lista, ANTES del IVA. Como todo lo
    // de abajo (impuestos, comisiones, margen) es lineal en el neto, aplicarlo
    // acá hace que se recompute coherente solo. El costo es fijo → el descuento
    // lo absorbe el margen (puede quedar negativo; el gate vive aguas arriba).
    const descuentoUnitario = this.calcularDescuentoUnitario(
      netoLista,
      input.descuento,
      input.cantidad,
    );
    const neto = Math.max(0, netoLista - descuentoUnitario);

    const impuestosPorFuera = this.r((neto * cargas.porFueraPct) / 100);
    const brutoUnitario = this.r(neto + impuestosPorFuera);
    const netoUnitario = this.r(neto);

    const costosInternos = this.r(
      (neto * cargas.internosNetoPct) / 100 +
        (brutoUnitario * cargas.internosBrutoPct) / 100,
    );
    const totalComisiones = this.r(
      (neto * cargas.comisionesNetoPct) / 100 +
        (brutoUnitario * cargas.comisionesBrutoPct) / 100,
    );
    const totalImpuestos = this.r(impuestosPorFuera + costosInternos);
    const precioBase = this.r(neto - costosInternos - totalComisiones);

    const precioNetoTotal = this.r(netoUnitario * input.cantidad);
    const precioBrutoTotal = this.r(brutoUnitario * input.cantidad);

    const margenEfectivoPct =
      netoUnitario > 0
        ? redondear(
            ((precioBase - input.costoUnitario) / netoUnitario) * 100,
            2,
          )
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
      descuento: {
        aplicado: descuentoUnitario > 0,
        montoUnitario: this.r(descuentoUnitario),
        montoTotal: this.r(descuentoUnitario * input.cantidad),
        netoListaUnitario: this.r(netoLista),
        netoListaTotal: this.r(netoLista * input.cantidad),
      },
      snapshots: {
        precioConfig: input.precioConfig,
        impuestos: input.impuestos,
        comisiones: input.comisiones,
        precioEspecialCliente: input.precioEspecialCliente ?? null,
      },
    };
  }

  // ── Normalización de cargas ──────────────────────────────────────────

  private normalizarCargas(
    impuestos: ImpuestoSnapshot[],
    comisiones: AplicarPrecioInput['comisiones'],
  ): CargasNormalizadas {
    let porFueraPct = 0;
    let internosNetoPct = 0;
    let internosBrutoPct = 0;

    for (const imp of impuestos) {
      const traslado = imp.traslado ?? 'POR_DENTRO';
      const base = imp.baseCalculo ?? 'NETO';
      if (traslado === 'POR_FUERA') {
        if (base !== 'NETO') {
          throw new BadRequestException(
            `Impuesto "${imp.codigo}": un impuesto POR_FUERA (tipo IVA) solo puede calcularse sobre el NETO.`,
          );
        }
        porFueraPct += imp.porcentaje;
      } else if (base === 'BRUTO_COBRADO') {
        internosBrutoPct += imp.porcentaje;
      } else {
        internosNetoPct += imp.porcentaje;
      }
    }

    let comisionesNetoPct = 0;
    let comisionesBrutoPct = 0;
    for (const com of comisiones) {
      if ((com.baseCalculo ?? 'NETO') === 'BRUTO_COBRADO') {
        comisionesBrutoPct += com.porcentaje;
      } else {
        comisionesNetoPct += com.porcentaje;
      }
    }

    const factorPorFuera = 1 + porFueraPct / 100;
    const cargaInternaNetoPct =
      internosNetoPct +
      comisionesNetoPct +
      (internosBrutoPct + comisionesBrutoPct) * factorPorFuera;

    return {
      porFueraPct,
      internosNetoPct,
      internosBrutoPct,
      comisionesNetoPct,
      comisionesBrutoPct,
      factorPorFuera,
      cargaInternaNetoPct,
    };
  }

  /**
   * Cuánto se descuenta del neto de lista, POR UNIDAD. El `MONTO` es sobre el
   * neto total de la línea, así que se prorratea por cantidad. Clampeado para
   * no dejar el neto negativo y para ignorar valores <= 0.
   */
  private calcularDescuentoUnitario(
    netoLista: number,
    descuento: DescuentoPrecio | null | undefined,
    cantidad: number,
  ): number {
    if (!descuento || descuento.valor <= 0) return 0;
    if (descuento.tipo === 'PORCENTAJE') {
      const pct = Math.min(100, descuento.valor);
      return (netoLista * pct) / 100;
    }
    // MONTO: $ sobre el neto TOTAL de la línea → por unidad.
    if (cantidad <= 0) return 0;
    return Math.min(netoLista, descuento.valor / cantidad);
  }

  // ── Métodos de cálculo del precio NETO ───────────────────────────────

  private calcularNeto(
    config: PrecioConfig,
    costo: number,
    cantidad: number,
    cargas: CargasNormalizadas,
  ): number {
    switch (config.metodoCalculo) {
      case 'por_margen':
        return this.porMargen(
          config.detalle as unknown as DetallePorMargen,
          costo,
          cargas,
        );

      case 'precio_fijo':
        return this.netoDesdePrecioConfigurado(
          this.precioFijo(config.detalle as unknown as DetallePrecioFijo),
          config,
          cargas,
        );

      case 'precio_fijo_para_margen_minimo':
        return this.precioFijoParaMargenMinimo(
          config.detalle as unknown as DetallePrecioFijoParaMargenMinimo,
          config,
          costo,
          cargas,
        );

      case 'margen_variable':
        return this.margenVariable(
          config.detalle as unknown as DetalleMargenVariable,
          costo,
          cantidad,
          cargas,
        );

      case 'variable_por_cantidad':
        return this.netoDesdePrecioConfigurado(
          this.variablePorCantidad(
            config.detalle as unknown as DetalleVariablePorCantidad,
            cantidad,
          ),
          config,
          cargas,
        );

      case 'fijado_por_cantidad':
        return this.netoDesdePrecioConfigurado(
          this.fijadoPorCantidad(
            config.detalle as unknown as DetalleFijadoPorCantidad,
            cantidad,
          ),
          config,
          cargas,
        );

      case 'fijo_con_margen_variable':
        return this.fijoConMargenVariable(
          config.detalle as unknown as DetalleFijoConMargenVariable,
          costo,
          cantidad,
          cargas,
        );

      default:
        throw new BadRequestException(
          `Método de cálculo no soportado: ${config.metodoCalculo as string}`,
        );
    }
  }

  /**
   * Convierte un precio configurado a NETO según `detalle.precioIncluyeIva`
   * (default true: el precio de lista configurado es el total factura, con
   * los impuestos por fuera adentro → neto = precio / (1 + iva%)).
   */
  private netoDesdePrecioConfigurado(
    precioConfigurado: number,
    config: PrecioConfig,
    cargas: CargasNormalizadas,
  ): number {
    const incluyeIva = (config.detalle?.precioIncluyeIva ?? true) !== false;
    return this.r(
      incluyeIva ? precioConfigurado / cargas.factorPorFuera : precioConfigurado,
    );
  }

  /** Neto necesario para preservar margen objetivo sobre el neto. */
  private porMargen(
    detalle: DetallePorMargen,
    costo: number,
    cargas: CargasNormalizadas,
  ): number {
    if (typeof detalle.marginPct !== 'number') {
      throw new BadRequestException('por_margen requiere `marginPct`');
    }
    return this.netoDesdeMargenObjetivo(costo, detalle.marginPct, cargas);
  }

  /** precio = price (config). */
  private precioFijo(detalle: DetallePrecioFijo): number {
    if (typeof detalle.price !== 'number') {
      throw new BadRequestException('precio_fijo requiere `price`');
    }
    return this.r(detalle.price);
  }

  /** neto = max(neto del price, neto necesario para preservar margen mínimo). */
  private precioFijoParaMargenMinimo(
    detalle: DetallePrecioFijoParaMargenMinimo,
    config: PrecioConfig,
    costo: number,
    cargas: CargasNormalizadas,
  ): number {
    if (
      typeof detalle.price !== 'number' ||
      typeof detalle.minimumMarginPct !== 'number'
    ) {
      throw new BadRequestException(
        'precio_fijo_para_margen_minimo requiere `price` y `minimumMarginPct`',
      );
    }
    const netoPrice = this.netoDesdePrecioConfigurado(
      detalle.price,
      config,
      cargas,
    );
    const piso = this.netoDesdeMargenObjetivo(
      costo,
      detalle.minimumMarginPct,
      cargas,
    );
    return this.r(Math.max(netoPrice, piso));
  }

  /** Tramos por rango: el primer `quantityUntil >= cantidad` define el margen. */
  private margenVariable(
    detalle: DetalleMargenVariable,
    costo: number,
    cantidad: number,
    cargas: CargasNormalizadas,
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
    return this.netoDesdeMargenObjetivo(costo, tramo.marginPct, cargas);
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
    return this.r(tramo.price);
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
    return this.r(tramo.price);
  }

  /** Cantidades exactas con margen objetivo sobre el neto. */
  private fijoConMargenVariable(
    detalle: DetalleFijoConMargenVariable,
    costo: number,
    cantidad: number,
    cargas: CargasNormalizadas,
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
    return this.netoDesdeMargenObjetivo(costo, tramo.marginPct, cargas);
  }

  /**
   * Gross-up sobre el neto: margen objetivo + costos internos + comisiones,
   * todos definidos como % del neto.
   *   neto = costo / (1 − margen% − cargaInterna%)
   */
  private netoDesdeMargenObjetivo(
    costo: number,
    margenPct: number,
    cargas: CargasNormalizadas,
  ): number {
    if (!Number.isFinite(margenPct) || margenPct < 0) {
      throw new BadRequestException('marginPct debe ser número >= 0');
    }
    const tasaTotal = (margenPct + cargas.cargaInternaNetoPct) / 100;
    if (tasaTotal >= 1) {
      throw new BadRequestException(
        'La suma de margen objetivo, costos impositivos internos y comisiones debe ser menor al 100% del precio neto.',
      );
    }
    return this.r(costo / (1 - tasaTotal));
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
