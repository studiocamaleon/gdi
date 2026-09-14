import {
  calcularResumen,
  type PropuestaCargoDirecto,
  type PropuestaItem,
} from "./propuestas";

/** Presentación monetaria de snapshots. No modifica ni recotiza productos. */
export function formatCantidadItem(item: PropuestaItem) {
  const acceptsDecimals =
    item.unidadMedida === "m2" || item.unidadMedida === "metro_lineal";
  const maximumFractionDigits = acceptsDecimals ? 2 : 0;
  const minimumFractionDigits =
    acceptsDecimals && !Number.isInteger(item.cantidad) ? 2 : 0;

  return item.cantidad.toLocaleString("es-AR", {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

type ImpuestoResumenLinea = {
  key: string;
  nombre: string;
  porcentaje: number;
  monto: number;
};

function getImpuestosItemResumen(item: PropuestaItem) {
  const desglose = item.cotizacion.desglosePrecio;
  const lineas: ImpuestoResumenLinea[] = [];
  let ocultos = 0;

  if (!desglose) {
    return { visibles: lineas, ocultos };
  }

  // Solo los impuestos POR_FUERA (IVA) son líneas que se agregan al neto y
  // pueden mostrarse/ocultarse al cliente: su monto es % del neto. Los
  // POR_DENTRO (IIBB, imp. al cheque) son costos ya embebidos en el precio
  // neto — nunca se listan ni ajustan el subtotal.
  const netoTotal = desglose.precioNetoTotal ?? 0;
  for (const impuesto of desglose.impuestos ?? []) {
    if ((impuesto.traslado ?? "POR_DENTRO") !== "POR_FUERA") continue;
    const monto = netoTotal * (impuesto.porcentaje / 100);
    if (monto <= 0) continue;
    if (impuesto.desglosarCliente === false) {
      ocultos += monto;
      continue;
    }

    lineas.push({
      key: impuesto.catalogoId || impuesto.codigo || impuesto.nombre,
      nombre: impuesto.nombre,
      porcentaje: impuesto.porcentaje,
      monto,
    });
  }

  return { visibles: lineas, ocultos };
}

function roundVisibleCurrency(value: number) {
  return Math.round(value);
}

export function getItemOrderVisibleAmounts(item: PropuestaItem) {
  const impuestosResumen = getImpuestosItemResumen(item);
  const subtotal = roundVisibleCurrency(
    item.subtotal + impuestosResumen.ocultos,
  );
  const impuestos = roundVisibleCurrency(
    Math.max(0, item.impuestoMonto - impuestosResumen.ocultos),
  );
  return {
    subtotal,
    impuestos,
    total: roundVisibleCurrency(item.total),
  };
}

export function descuentoMontoDeItem(item: PropuestaItem): number {
  const descuento = item.cotizacion.desglosePrecio?.descuento;
  return descuento?.aplicado ? descuento.montoTotal : 0;
}

export function calcularResumenOrden(
  items: PropuestaItem[],
  cargosOrden: PropuestaCargoDirecto[],
) {
  const productos = calcularResumen(items);
  const cargosSubtotal = cargosOrden.reduce(
    (acc, cargo) => acc + cargo.montoNeto,
    0,
  );
  const cargosImpuestos = cargosOrden.reduce(
    (acc, cargo) => acc + cargo.impuestoMonto,
    0,
  );
  const cargosTotal = cargosOrden.reduce((acc, cargo) => acc + cargo.total, 0);

  return {
    productos,
    cargosSubtotal,
    cargosImpuestos,
    cargosTotal,
    subtotal: productos.subtotal + cargosSubtotal,
    impuestos: productos.impuestos + cargosImpuestos,
    total: productos.total + cargosTotal,
    cantidadItems: productos.cantidadItems,
  };
}
