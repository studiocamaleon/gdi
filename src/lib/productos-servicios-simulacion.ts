import type { ProductoPrecioConfig } from "@/lib/productos-servicios";

export type SimulacionComercialStatus = "sin_cotizacion" | "disponible" | "no_calculable";

export type SimulacionComercialResultado = {
  status: SimulacionComercialStatus;
  reason: string | null;
  metodoAplicado: string | null;
  costoTotal: number;
  cantidad: number | null;
  margenObjetivoPct: number | null;
  margenObjetivoMonto: number | null;
  impuestosPct: number;
  comisionesPct: number;
  tasaTotalPct: number;
  baseObjetivo: number | null;
  precioFinal: number | null;
  impuestosMonto: number | null;
  comisionesMonto: number | null;
  cargosTotalesMonto: number | null;
  margenRealMonto: number | null;
  margenRealPct: number | null;
  valorComercial: number | null;
  beneficioMonto: number | null;
  beneficioPct: number | null;
  vmcMonto: number | null;
  icmPct: number | null;
  descripcion: string | null;
};

type SimularPrecioComercialInput = {
  precio: ProductoPrecioConfig | null | undefined;
  costoTotal: number | null | undefined;
  cantidad: number | null | undefined;
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function getImpuestosPct(precio: ProductoPrecioConfig) {
  if (precio.impuestos.items?.length) {
    return roundMoney(
      precio.impuestos.items.reduce((sum, item) => sum + Number(item.porcentaje || 0), 0),
    );
  }
  return roundMoney(precio.impuestos.porcentajeTotal ?? 0);
}

function getComisionesPct(precio: ProductoPrecioConfig) {
  if (precio.comisiones.items?.length) {
    const activeItems = precio.comisiones.items.filter((item) => item.activo);
    const activeTotal = roundMoney(
      activeItems.reduce((sum, item) => sum + Number(item.porcentaje || 0), 0),
    );
    if (activeItems.length > 0 || Number(precio.comisiones.porcentajeTotal ?? 0) <= 0) {
      return activeTotal;
    }
  }
  return roundMoney(precio.comisiones.porcentajeTotal ?? 0);
}

function buildNoCalculable(
  input: Pick<SimulacionComercialResultado, "costoTotal" | "cantidad" | "impuestosPct" | "comisionesPct" | "tasaTotalPct">,
  reason: string,
  metodoAplicado: string | null = null,
): SimulacionComercialResultado {
  return {
    status: "no_calculable",
    reason,
    metodoAplicado,
    costoTotal: input.costoTotal,
    cantidad: input.cantidad,
    margenObjetivoPct: null,
    margenObjetivoMonto: null,
    impuestosPct: input.impuestosPct,
    comisionesPct: input.comisionesPct,
    tasaTotalPct: input.tasaTotalPct,
    baseObjetivo: null,
    precioFinal: null,
    impuestosMonto: null,
    comisionesMonto: null,
    cargosTotalesMonto: null,
    margenRealMonto: null,
    margenRealPct: null,
    valorComercial: null,
    beneficioMonto: null,
    beneficioPct: null,
    vmcMonto: null,
    icmPct: null,
    descripcion: null,
  };
}

function buildFromFinalPrice(
  precio: ProductoPrecioConfig,
  costoTotal: number,
  cantidad: number | null,
  precioFinal: number,
  margenObjetivoPct: number | null,
  descripcion: string,
): SimulacionComercialResultado {
  const impuestosPct = getImpuestosPct(precio);
  const comisionesPct = getComisionesPct(precio);
  const tasaTotalPct = impuestosPct + comisionesPct;
  const impuestosMonto = roundMoney(precioFinal * (impuestosPct / 100));
  const comisionesMonto = roundMoney(precioFinal * (comisionesPct / 100));
  const cargosTotalesMonto = roundMoney(impuestosMonto + comisionesMonto);
  const baseObjetivo = roundMoney(precioFinal - cargosTotalesMonto);
  const margenObjetivoMonto =
    margenObjetivoPct != null ? roundMoney(precioFinal * (margenObjetivoPct / 100)) : null;
  const margenRealMonto = roundMoney(baseObjetivo - costoTotal);
  const margenRealPct = precioFinal > 0 ? roundMoney((margenRealMonto / precioFinal) * 100) : 0;
  const valorComercial = roundMoney(precioFinal);
  const beneficioMonto = margenRealMonto;
  const beneficioPct = margenRealPct;
  const vmcMonto = roundMoney(precioFinal - costoTotal);
  const icmPct = precioFinal > 0 ? roundMoney((vmcMonto / precioFinal) * 100) : 0;

  return {
    status: "disponible",
    reason: null,
    metodoAplicado: precio.metodoCalculo,
    costoTotal,
    cantidad,
    margenObjetivoPct,
    margenObjetivoMonto,
    impuestosPct,
    comisionesPct,
    tasaTotalPct,
    baseObjetivo,
    precioFinal: roundMoney(precioFinal),
    impuestosMonto,
    comisionesMonto,
    cargosTotalesMonto,
    margenRealMonto,
    margenRealPct,
    valorComercial,
    beneficioMonto,
    beneficioPct,
    vmcMonto,
    icmPct,
    descripcion,
  };
}

export function simularPrecioComercial({
  precio,
  costoTotal,
  cantidad,
}: SimularPrecioComercialInput): SimulacionComercialResultado {
  if (!precio || !Number.isFinite(Number(costoTotal))) {
    return {
      status: "sin_cotizacion",
      reason: "Primero generá una cotización en Costos para poder simular el precio comercial.",
      metodoAplicado: null,
      costoTotal: Number(costoTotal ?? 0),
      cantidad: Number.isFinite(Number(cantidad)) ? Number(cantidad) : null,
      margenObjetivoPct: null,
      margenObjetivoMonto: null,
      impuestosPct: precio ? getImpuestosPct(precio) : 0,
      comisionesPct: precio ? getComisionesPct(precio) : 0,
      tasaTotalPct: precio ? getImpuestosPct(precio) + getComisionesPct(precio) : 0,
      baseObjetivo: null,
      precioFinal: null,
      impuestosMonto: null,
      comisionesMonto: null,
      cargosTotalesMonto: null,
      margenRealMonto: null,
      margenRealPct: null,
      valorComercial: null,
      beneficioMonto: null,
      beneficioPct: null,
      vmcMonto: null,
      icmPct: null,
      descripcion: null,
    };
  }

  const normalizedCost = roundMoney(Number(costoTotal));
  const normalizedQuantity = Number.isFinite(Number(cantidad)) ? Math.max(0, Number(cantidad)) : null;
  const impuestosPct = getImpuestosPct(precio);
  const comisionesPct = getComisionesPct(precio);
  const tasaTotalPct = impuestosPct + comisionesPct;
  const tasaTotal = tasaTotalPct / 100;

  if (tasaTotal >= 1) {
    return buildNoCalculable(
      {
        costoTotal: normalizedCost,
        cantidad: normalizedQuantity,
        impuestosPct,
        comisionesPct,
        tasaTotalPct,
      },
      "La suma de impuestos y comisiones no puede ser igual o mayor al 100%.",
      precio.metodoCalculo,
    );
  }

  if (precio.metodoCalculo === "por_margen") {
    const margenObjetivoPct = precio.detalle.marginPct;
    const tasaMargen = margenObjetivoPct / 100;
    if (tasaTotal + tasaMargen >= 1) {
      return buildNoCalculable(
        { costoTotal: normalizedCost, cantidad: normalizedQuantity, impuestosPct, comisionesPct, tasaTotalPct },
        "La suma de impuestos, comisiones y margen objetivo no puede ser igual o mayor al 100% del precio final.",
        precio.metodoCalculo,
      );
    }
    const precioFinal = normalizedCost / (1 - tasaTotal - tasaMargen);
    return buildFromFinalPrice(
      precio,
      normalizedCost,
      normalizedQuantity,
      precioFinal,
      margenObjetivoPct,
      "Precio calculado para que el margen fijo quede intacto sobre el precio final, cubriendo costos, impuestos y comisiones.",
    );
  }

  if (precio.metodoCalculo === "margen_variable") {
    if (normalizedQuantity == null || normalizedQuantity <= 0) {
      return buildNoCalculable(
        { costoTotal: normalizedCost, cantidad: normalizedQuantity, impuestosPct, comisionesPct, tasaTotalPct },
        "La cantidad cotizada no es válida para calcular el tramo de margen.",
        precio.metodoCalculo,
      );
    }
    const tier = precio.detalle.tiers.find((item) => normalizedQuantity <= item.quantityUntil);
    if (!tier) {
      return buildNoCalculable(
        { costoTotal: normalizedCost, cantidad: normalizedQuantity, impuestosPct, comisionesPct, tasaTotalPct },
        "No existe un rango de margen que cubra la cantidad cotizada.",
        precio.metodoCalculo,
      );
    }
    const tasaMargen = tier.marginPct / 100;
    if (tasaTotal + tasaMargen >= 1) {
      return buildNoCalculable(
        { costoTotal: normalizedCost, cantidad: normalizedQuantity, impuestosPct, comisionesPct, tasaTotalPct },
        "La suma de impuestos, comisiones y margen objetivo no puede ser igual o mayor al 100% del precio final.",
        precio.metodoCalculo,
      );
    }
    const precioFinal = normalizedCost / (1 - tasaTotal - tasaMargen);
    return buildFromFinalPrice(
      precio,
      normalizedCost,
      normalizedQuantity,
      precioFinal,
      tier.marginPct,
      `Precio calculado usando el tramo hasta ${tier.quantityUntil} para preservar un margen del ${tier.marginPct}% sobre el precio final.`,
    );
  }

  if (precio.metodoCalculo === "fijo_con_margen_variable") {
    if (normalizedQuantity == null || normalizedQuantity <= 0) {
      return buildNoCalculable(
        { costoTotal: normalizedCost, cantidad: normalizedQuantity, impuestosPct, comisionesPct, tasaTotalPct },
        "La cantidad cotizada no es válida para calcular el margen por cantidad fija.",
        precio.metodoCalculo,
      );
    }
    const tier = precio.detalle.tiers.find((item) => item.quantity === normalizedQuantity);
    if (!tier) {
      return buildNoCalculable(
        { costoTotal: normalizedCost, cantidad: normalizedQuantity, impuestosPct, comisionesPct, tasaTotalPct },
        "La cantidad cotizada no coincide con una cantidad fija configurada.",
        precio.metodoCalculo,
      );
    }
    const tasaMargen = tier.marginPct / 100;
    if (tasaTotal + tasaMargen >= 1) {
      return buildNoCalculable(
        { costoTotal: normalizedCost, cantidad: normalizedQuantity, impuestosPct, comisionesPct, tasaTotalPct },
        "La suma de impuestos, comisiones y margen objetivo no puede ser igual o mayor al 100% del precio final.",
        precio.metodoCalculo,
      );
    }
    const precioFinal = normalizedCost / (1 - tasaTotal - tasaMargen);
    return buildFromFinalPrice(
      precio,
      normalizedCost,
      normalizedQuantity,
      precioFinal,
      tier.marginPct,
      `Precio calculado para la cantidad fija ${tier.quantity} preservando un margen del ${tier.marginPct}% sobre el precio final.`,
    );
  }

  if (precio.metodoCalculo === "precio_fijo") {
    return buildFromFinalPrice(
      precio,
      normalizedCost,
      normalizedQuantity,
      precio.detalle.price,
      null,
      "Precio fijo configurado manualmente y evaluación del margen real resultante.",
    );
  }

  if (precio.metodoCalculo === "fijado_por_cantidad") {
    if (normalizedQuantity == null || normalizedQuantity <= 0) {
      return buildNoCalculable(
        { costoTotal: normalizedCost, cantidad: normalizedQuantity, impuestosPct, comisionesPct, tasaTotalPct },
        "La cantidad cotizada no es válida para las cantidades fijas configuradas.",
        precio.metodoCalculo,
      );
    }
    const tier = precio.detalle.tiers.find((item) => item.quantity === normalizedQuantity);
    if (!tier) {
      return buildNoCalculable(
        { costoTotal: normalizedCost, cantidad: normalizedQuantity, impuestosPct, comisionesPct, tasaTotalPct },
        "La cantidad cotizada no coincide con una cantidad fija habilitada.",
        precio.metodoCalculo,
      );
    }
    return buildFromFinalPrice(
      precio,
      normalizedCost,
      normalizedQuantity,
      tier.price,
      null,
      `Precio fijo configurado para la cantidad exacta ${tier.quantity}.`,
    );
  }

  if (precio.metodoCalculo === "variable_por_cantidad") {
    if (normalizedQuantity == null || normalizedQuantity <= 0) {
      return buildNoCalculable(
        { costoTotal: normalizedCost, cantidad: normalizedQuantity, impuestosPct, comisionesPct, tasaTotalPct },
        "La cantidad cotizada no es válida para calcular el rango de precio.",
        precio.metodoCalculo,
      );
    }
    const tier = precio.detalle.tiers.find((item) => normalizedQuantity <= item.quantityUntil);
    if (!tier) {
      return buildNoCalculable(
        { costoTotal: normalizedCost, cantidad: normalizedQuantity, impuestosPct, comisionesPct, tasaTotalPct },
        "No existe un rango de precio que cubra la cantidad cotizada.",
        precio.metodoCalculo,
      );
    }
    return buildFromFinalPrice(
      precio,
      normalizedCost,
      normalizedQuantity,
      tier.price,
      null,
      `Precio fijo tomado del rango hasta ${tier.quantityUntil}.`,
    );
  }

  return buildNoCalculable(
    { costoTotal: normalizedCost, cantidad: normalizedQuantity, impuestosPct, comisionesPct, tasaTotalPct },
    "El método de cálculo configurado todavía no está soportado en la simulación comercial.",
    precio.metodoCalculo,
  );
}
