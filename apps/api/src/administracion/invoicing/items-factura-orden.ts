import { BadRequestException } from '@nestjs/common';
import type { LetraProvider } from './invoicing-provider';
import { IVA_ID } from './codigos-arca';
import { calcularTotales, type ItemCalculo } from './totales-comprobante';

export type DetalleFactura = 'items' | 'orden';
type Numero = number | { toString(): string };
export type OrdenParaFactura = {
  numero: string;
  total: Numero | null;
  facturadoTotal: Numero;
  cargosDirectosJson?: unknown;
  items: Array<{
    parentItemId?: string | null;
    nombre: string;
    cantidad: Numero;
    subtotal: Numero;
    total: Numero;
    descuentoMonto: Numero | null;
    cotizacionItem?: { impuestosSnapshotJson: unknown } | null;
  }>;
};
type Linea = ItemCalculo & { descripcion: string };
const r2 = (n: number) => Math.round(n * 100) / 100;
const objeto = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

function alicuota(
  neto: number,
  total: number,
  snapshot: unknown,
  nombre: string,
): number {
  const externos = Array.isArray(snapshot)
    ? snapshot.map(objeto).filter((i) => i.traslado === 'POR_FUERA')
    : [];
  const guardada =
    externos.length === 1 ? Number(externos[0].porcentaje) : null;
  if (
    guardada !== null &&
    IVA_ID[guardada] !== undefined &&
    Math.abs(total - neto * (1 + guardada / 100)) <= 0.51
  )
    return guardada;
  // Órdenes históricas sin snapshot: sólo aceptar una alícuota compatible
  // con los importes guardados; nunca consultar precios actuales del catálogo.
  if (neto === 0 && total === 0)
    return guardada !== null && IVA_ID[guardada] !== undefined ? guardada : 21;
  const candidatas = Object.keys(IVA_ID)
    .map(Number)
    .filter((a) => Math.abs(total - neto * (1 + a / 100)) <= 0.51);
  if (candidatas.length === 1) return candidatas[0];
  if (Math.abs(total - neto * 1.21) < 0.005) return 21;
  if (Math.abs(total - neto) < 0.005) return 0;
  throw new BadRequestException(
    `No se pudo determinar el IVA de «${nombre}». Revisá los importes de la orden antes de facturar.`,
  );
}

/** Concilia el redondeo fiscal global sin redondear cada precio unitario.
 * El total pactado no cambia; ajusta una fracción de centavo de la base.
 */
export function conciliarRenglones(
  letra: LetraProvider,
  lineas: Linea[],
  monto: number,
): Linea[] {
  const objetivo = r2(monto);
  const actual = calcularTotales(letra, lineas).total;
  if (actual === objetivo) return lineas;
  if (Math.abs(actual - objetivo) > Math.max(0.02, lineas.length * 0.01))
    throw new BadRequestException(
      'No se pudo conciliar el importe fiscal. Revisá la orden antes de facturar.',
    );
  const ajustables = lineas.filter(
    (i) =>
      i.precioUnitarioSinIva > 0 &&
      i.cantidad > 0 &&
      (i.bonificacionPct ?? 0) < 100,
  );
  const linea = ajustables.sort(
    (a, b) =>
      b.cantidad * b.precioUnitarioSinIva - a.cantidad * a.precioUnitarioSinIva,
  )[0];
  if (!linea)
    throw new BadRequestException('No se pudo conciliar el importe fiscal.');
  const escala = linea.cantidad * (1 - (linea.bonificacionPct ?? 0) / 100);
  const amplitud = (Math.abs(actual - objetivo) + 0.02) / escala;
  let menor = Math.max(0, linea.precioUnitarioSinIva - amplitud);
  let mayor = linea.precioUnitarioSinIva + amplitud;
  for (let i = 0; i < 50; i++) {
    linea.precioUnitarioSinIva = (menor + mayor) / 2;
    const calculado = calcularTotales(letra, lineas).total;
    if (calculado === objetivo) return lineas;
    if (calculado < objetivo) menor = linea.precioUnitarioSinIva;
    else mayor = linea.precioUnitarioSinIva;
  }
  throw new BadRequestException(
    'No se pudo conciliar el importe fiscal. Revisá la orden antes de facturar.',
  );
}

/** Trabaja con snapshots comerciales: no factura hijos internos ni costos. */
export function renglonesFacturaOrden(
  orden: OrdenParaFactura,
  letra: LetraProvider,
  monto: number,
  detalle: DetalleFactura,
  concepto = `Trabajos de impresión — ${orden.numero}`,
  identificarOrden = false,
): Linea[] {
  const fuentes = orden.items
    .filter((i) => i.parentItemId == null)
    .map((i) => ({
      nombre: i.nombre,
      cantidad: Number(i.cantidad),
      neto: Number(i.subtotal),
      total: Number(i.total),
      descuento: Number(i.descuentoMonto ?? 0),
      impuestos: i.cotizacionItem?.impuestosSnapshotJson,
    }));
  for (const raw of Array.isArray(orden.cargosDirectosJson)
    ? orden.cargosDirectosJson
    : []) {
    const cargo = objeto(raw);
    fuentes.push({
      nombre:
        typeof cargo.nombreSnapshot === 'string'
          ? cargo.nombreSnapshot
          : 'Cargo de la orden',
      // Un cargo es un concepto completo. cantidadInput es su base (km, días,
      // porcentaje...), no otra cantidad que deba multiplicar nuevamente el monto.
      cantidad: 1,
      neto: Number(cargo.montoNeto),
      total: Number(cargo.total),
      descuento: 0,
      impuestos: [
        { traslado: 'POR_FUERA', porcentaje: cargo.impuestoPorcentaje ?? 21 },
      ],
    });
  }
  const totalOrden = Number(orden.total);
  const completo =
    Number(orden.facturadoTotal) <= 0.01 &&
    Math.abs(monto - totalOrden) < 0.005;
  if (!fuentes.length) {
    return [
      {
        descripcion: concepto,
        cantidad: 1,
        precioUnitarioSinIva: letra === 'A' ? monto / 1.21 : monto,
        alicuotaIva: 21,
      },
    ];
  }
  if (
    fuentes.some(
      (f) =>
        ![f.neto, f.total, f.descuento, f.cantidad].every(Number.isFinite) ||
        f.neto < 0 ||
        f.total < 0,
    ) ||
    Math.abs(r2(fuentes.reduce((s, f) => s + f.total, 0)) - totalOrden) > 0.01
  ) {
    throw new BadRequestException(
      'El detalle de productos y cargos no coincide con el total de la orden. Revisala antes de facturar.',
    );
  }
  const lineas: Linea[] = fuentes.map((f) => {
    const tasa =
      letra === 'C' || letra === 'E'
        ? 0
        : alicuota(f.neto, f.total, f.impuestos, f.nombre);
    const pct =
      f.neto + f.descuento > 0
        ? (f.descuento / (f.neto + f.descuento)) * 100
        : 0;
    // El bruto guardado manda. Evita alterar la deuda por el redondeo
    // comercial y no redondea el unitario antes de multiplicar la cantidad.
    const base = letra === 'A' ? f.total / (1 + tasa / 100) : f.total;
    const lista = pct < 100 ? base / (1 - pct / 100) : f.descuento;
    const cantidad = f.cantidad > 0 ? f.cantidad : 1;
    return {
      descripcion: identificarOrden
        ? `${orden.numero} · ${f.nombre}`
        : f.nombre,
      cantidad,
      precioUnitarioSinIva: lista / cantidad,
      alicuotaIva: tasa,
      ...(pct > 0 ? { bonificacionPct: pct } : {}),
    };
  });
  if (detalle === 'items' && completo)
    return conciliarRenglones(letra, lineas, monto);
  // Los parciales se expresan por importe, sin afirmar que se facturaron
  // todas las unidades. Resumen por alícuota para no cambiar el IVA del detalle.
  const bases = new Map<number | 'exento' | 'no_gravado', number>();
  for (const item of lineas) {
    const base =
      item.cantidad *
      item.precioUnitarioSinIva *
      (1 - (item.bonificacionPct ?? 0) / 100);
    bases.set(item.alicuotaIva, (bases.get(item.alicuotaIva) ?? 0) + base);
  }
  const factor = monto / totalOrden;
  const resumen = [...bases].map(([tasa, base]) => ({
    descripcion: `${completo ? '' : 'Facturación parcial · '}${concepto}${bases.size > 1 ? ` · IVA ${tasa}%` : ''}`,
    cantidad: 1,
    precioUnitarioSinIva: base * factor,
    alicuotaIva: tasa,
  }));
  return conciliarRenglones(letra, resumen, monto);
}
