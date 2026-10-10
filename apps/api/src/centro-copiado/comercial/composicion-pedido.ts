import type {
  ComposicionPedidoComercial,
  ConceptoCompuestoComercial,
  DesgloseFiscalComercial,
  PedidoComposicionComercial,
  PoliticaComposicionComercial,
  ReglasComposicionComercial,
} from './composicion-pedido.types';
import { DecimalComercial, exigir, identificador } from './validaciones';

/** Admite totales de precio × cantidad segura, sin pasar por números binarios. */
function importe(valor: string, etiqueta: string, enteros = 34) {
  exigir(
    typeof valor === 'string' &&
      new RegExp(`^\\d{1,${enteros}}(\\.\\d{1,12})?$`).test(valor),
    `${etiqueta}: debe ser un decimal no negativo dentro del límite de cálculo.`,
  );
  return new DecimalComercial(valor);
}

function alicuota(valor: string) {
  exigir(
    typeof valor === 'string' && /^\d{1,3}(\.\d{1,8})?$/.test(valor),
    'La alícuota de IVA debe estar resuelta explícitamente.',
  );
  const porcentaje = new DecimalComercial(valor);
  exigir(porcentaje.lte(100), 'La alícuota de IVA debe estar entre 0 y 100.');
  return porcentaje;
}

function redondear(
  valor: InstanceType<typeof DecimalComercial>,
  decimales: number,
) {
  return valor.toDecimalPlaces(decimales, DecimalComercial.ROUND_HALF_UP);
}

function componerConcepto(
  valor: string | null,
  ivaPorcentaje: string,
  convencion: ReglasComposicionComercial['iva'],
  decimales: number,
): ConceptoCompuestoComercial {
  const tasa = alicuota(ivaPorcentaje).div(100);
  if (valor === null) {
    return {
      importeResuelto: null,
      importeEnConvencion: null,
      ivaPorcentaje,
      fiscal: null,
    };
  }
  const base = redondear(importe(valor, 'Importe del concepto'), decimales);
  const neto =
    convencion === 'INCLUIDO'
      ? redondear(base.div(tasa.plus(1)), decimales)
      : base;
  const iva =
    convencion === 'INCLUIDO'
      ? base.minus(neto)
      : redondear(neto.times(tasa), decimales);
  const total = neto.plus(iva);
  // Mantener neto + IVA = total, también con redondeo a enteros del tenant.
  return {
    importeResuelto: valor,
    importeEnConvencion: base.toFixed(decimales),
    ivaPorcentaje,
    fiscal: {
      neto: neto.toFixed(decimales),
      iva: iva.toFixed(decimales),
      total: total.toFixed(decimales),
    },
  };
}

function sumarFiscal(
  conceptos: readonly (DesgloseFiscalComercial | null)[],
  decimales: number,
): DesgloseFiscalComercial | null {
  let neto = new DecimalComercial(0);
  let iva = new DecimalComercial(0);
  for (const concepto of conceptos) {
    if (concepto === null) return null;
    neto = neto.plus(concepto.neto);
    iva = iva.plus(concepto.iva);
  }
  const total = neto.plus(iva).toFixed(decimales);
  importe(total, 'Importe acumulado');
  return { neto: neto.toFixed(decimales), iva: iva.toFixed(decimales), total };
}

function validarReglas(reglas: Readonly<ReglasComposicionComercial>) {
  exigir(
    reglas.iva === 'INCLUIDO' || reglas.iva === 'MAS_IVA',
    'Convención de IVA inválida.',
  );
  exigir(
    reglas.preparacion.modalidad === 'INCLUIDA' ||
      reglas.preparacion.modalidad === 'FIJA_PEDIDO',
    'Modalidad de preparación inválida.',
  );
  exigir(
    reglas.minimo.modalidad === 'SIN_MINIMO' ||
      reglas.minimo.modalidad === 'IMPORTE_PEDIDO',
    'Modalidad de mínimo inválida.',
  );
  if (reglas.preparacion.modalidad === 'FIJA_PEDIDO') {
    importe(reglas.preparacion.importe, 'Preparación fija', 18);
  }
  if (reglas.minimo.modalidad === 'IMPORTE_PEDIDO') {
    importe(reglas.minimo.importe, 'Importe mínimo', 18);
  }
}

/**
 * Composición pura de D17–D19. No resuelve ni autoriza acuerdos/descuentos/precios
 * manuales: recibe sus importes finales en la convención de la política principal.
 * No decide alícuotas, recalcula costos ni sustituye los controles de emisión.
 */
export function componerPedidoComercial(
  pedido: PedidoComposicionComercial,
  politica: PoliticaComposicionComercial,
): ComposicionPedidoComercial {
  for (const campo of ['tenantId', 'tarifarioId', 'versionId'] as const) {
    identificador(pedido[campo], campo);
    identificador(politica[campo], campo);
    exigir(
      pedido[campo] === politica[campo],
      `El pedido y su política principal no coinciden en ${campo}.`,
    );
  }
  identificador(pedido.pedidoId, 'Pedido');
  exigir(
    /^[A-Z]{3}$/.test(pedido.monedaCodigo) &&
      pedido.monedaCodigo === politica.monedaCodigo,
    'Los importes y la política deben usar la misma moneda.',
  );
  const decimales = pedido.decimalesPrecio;
  exigir(
    Number.isInteger(decimales) && decimales >= 0 && decimales <= 6,
    'La precisión monetaria debe estar resuelta entre 0 y 6 decimales.',
  );
  validarReglas(politica.reglas);
  const reglas = politica.reglas;
  const componer = (valor: string | null, porcentaje: string) =>
    componerConcepto(valor, porcentaje, reglas.iva, decimales);
  const hayImpresion = pedido.impresion.length > 0;
  exigir(
    hayImpresion || pedido.terminaciones.length === 0,
    'Las terminaciones deben pertenecer a impresiones del pedido.',
  );
  const claves = new Set<string>();
  const impresion = pedido.impresion.map((concepto) => {
    identificador(concepto.clave, 'Concepto de impresión');
    exigir(!claves.has(concepto.clave), 'Se repite un concepto de impresión.');
    claves.add(concepto.clave);
    return {
      clave: concepto.clave,
      ...componer(concepto.importeResuelto, concepto.ivaPorcentaje),
    };
  });
  const preparacionConfigurada =
    reglas.preparacion.modalidad === 'FIJA_PEDIDO'
      ? reglas.preparacion.importe
      : '0';
  const preparacionAjustada = pedido.preparacion.importeAjustado;
  if (preparacionAjustada !== undefined) {
    importe(preparacionAjustada, 'Preparación ajustada');
    exigir(
      reglas.preparacion.modalidad === 'FIJA_PEDIDO',
      'La preparación incluida no admite un cargo comercial adicional.',
    );
  }
  const preparacion = {
    importeConfigurado: preparacionConfigurada,
    ...componer(
      hayImpresion ? (preparacionAjustada ?? preparacionConfigurada) : '0',
      pedido.preparacion.ivaPorcentaje,
    ),
  };
  const subtotalImpresionPreparacion = sumarFiscal(
    [...impresion.map((c) => c.fiscal), preparacion.fiscal],
    decimales,
  );
  // Comparar la base monetaria realmente cobrable, después de ajustes y redondeo.
  const baseComparada = subtotalImpresionPreparacion
    ? reglas.iva === 'INCLUIDO'
      ? subtotalImpresionPreparacion.total
      : subtotalImpresionPreparacion.neto
    : null;
  const minimoConfigurado =
    reglas.minimo.modalidad === 'IMPORTE_PEDIDO' ? reglas.minimo.importe : null;
  const minimoExigible = redondear(
    new DecimalComercial(hayImpresion ? (minimoConfigurado ?? '0') : '0'),
    decimales,
  );
  const diferencia = minimoExigible.isZero()
    ? '0'
    : baseComparada === null
      ? null
      : DecimalComercial.max(0, minimoExigible.minus(baseComparada)).toFixed(
          decimales,
        );
  const minimo = {
    importeConfigurado: minimoConfigurado,
    baseComparada,
    importeExigible: minimoExigible.toFixed(decimales),
    ...componer(diferencia, pedido.ivaAjusteMinimoPorcentaje),
  };
  const subtotalAntesTerminaciones = sumarFiscal(
    [subtotalImpresionPreparacion, minimo.fiscal],
    decimales,
  );
  const clavesTerminaciones = new Set<string>();
  const terminaciones = pedido.terminaciones.map((t) => {
    identificador(t.clave, 'Terminación');
    exigir(
      !clavesTerminaciones.has(t.clave),
      'Se repite un concepto de terminación.',
    );
    clavesTerminaciones.add(t.clave);
    if (t.fiscal === null) return { clave: t.clave, fiscal: null };
    for (const valor of Object.values(t.fiscal)) {
      const monto = importe(valor, 'Importe de terminación');
      exigir(
        monto.eq(redondear(monto, decimales)),
        'La terminación debe estar redondeada con la precisión del pedido.',
      );
    }
    exigir(
      new DecimalComercial(t.fiscal.neto).plus(t.fiscal.iva).eq(t.fiscal.total),
      'El neto y el IVA de la terminación no coinciden con su total.',
    );
    return { clave: t.clave, fiscal: { ...t.fiscal } };
  });
  const subtotalTerminaciones = sumarFiscal(
    terminaciones.map((t) => t.fiscal),
    decimales,
  );
  const total = sumarFiscal(
    [subtotalAntesTerminaciones, subtotalTerminaciones],
    decimales,
  );
  const parciales = [
    ...impresion.map((c) => c.fiscal),
    preparacion.fiscal,
    minimo.fiscal,
    ...terminaciones.map((t) => t.fiscal),
  ].filter((f): f is DesgloseFiscalComercial => f !== null);
  return {
    tenantId: pedido.tenantId,
    pedidoId: pedido.pedidoId,
    tarifarioId: politica.tarifarioId,
    versionId: politica.versionId,
    monedaCodigo: pedido.monedaCodigo,
    decimalesPrecio: decimales,
    convencionIva: reglas.iva,
    estado: total === null ? 'PRECIO_PENDIENTE' : 'CALCULADO',
    impresion,
    preparacion,
    minimo,
    subtotalImpresionPreparacion,
    subtotalAntesTerminaciones,
    terminaciones,
    subtotalTerminaciones,
    parcialConPrecio: sumarFiscal(parciales, decimales)!,
    total,
  };
}
