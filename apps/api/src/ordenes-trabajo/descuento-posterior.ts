import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

type Linea = {
  subtotal: unknown;
  impuestos: unknown;
  descuentoMonto: unknown;
  impuestosSnapshotJson: unknown;
};
const numero = (v: unknown) => Number(v ?? 0);
export function netoListaPersistido(
  item: Pick<Linea, 'subtotal' | 'descuentoMonto'>,
) {
  return numero(item.subtotal) + numero(item.descuentoMonto);
}

/** Ajuste sobre el precio acordado; no vuelve a cotizar maquinaria ni materiales. */
export function descontarLineaPersistida(
  item: Linea,
  descuento: { tipo: 'PORCENTAJE' | 'MONTO'; valor: number } | null,
  decimales: number,
) {
  const redondear = (n: number) =>
    new Prisma.Decimal(n).toDecimalPlaces(decimales).toNumber();
  const lista = redondear(netoListaPersistido(item));
  if (!Number.isFinite(lista) || lista < 0)
    throw new BadRequestException('La línea no tiene un precio válido.');
  if (
    descuento &&
    (!Number.isFinite(descuento.valor) ||
      descuento.valor < 0 ||
      (descuento.tipo === 'PORCENTAJE' && descuento.valor > 100))
  )
    throw new BadRequestException(
      'El descuento debe ser un monto positivo o un porcentaje entre 0 y 100.',
    );
  const monto = descuento
    ? Math.min(
        lista,
        redondear(
          descuento.tipo === 'PORCENTAJE'
            ? (lista * descuento.valor) / 100
            : descuento.valor,
        ),
      )
    : 0;
  const subtotal = redondear(lista - monto);
  const snapshot = item.impuestosSnapshotJson;
  const tasa = Array.isArray(snapshot)
    ? snapshot.reduce(
        (s, i) =>
          s + (i?.traslado === 'POR_FUERA' ? numero(i.porcentaje) / 100 : 0),
        0,
      )
    : numero(item.subtotal) > 0
      ? numero(item.impuestos) / numero(item.subtotal)
      : 0;
  if (!Number.isFinite(tasa) || tasa < 0)
    throw new BadRequestException('La línea no tiene impuestos válidos.');
  if (
    !Array.isArray(snapshot) &&
    numero(item.subtotal) === 0 &&
    lista > 0 &&
    subtotal > 0
  )
    throw new BadRequestException(
      'No se pueden reconstruir los impuestos de esta línea histórica. Revisá su cotización.',
    );
  const impuestos = redondear(subtotal * tasa);
  return {
    subtotal,
    impuestos,
    total: redondear(subtotal + impuestos),
    descuentoTipo: descuento?.tipo ?? null,
    descuentoValor: descuento?.valor ?? null,
    descuentoMonto: monto,
  };
}

export function validarAjustePosterior(
  orden: { estado: string; facturadoTotal: unknown; updatedAt: Date },
  version: string,
  tieneComprobante: boolean,
) {
  if (orden.updatedAt.getTime() !== new Date(version).getTime())
    throw new ConflictException(
      'La orden cambió. Recargala antes de aplicar el descuento.',
    );
  if (orden.estado === 'cancelada')
    throw new ConflictException(
      'No se pueden aplicar descuentos a una orden cancelada.',
    );
  if (numero(orden.facturadoTotal) > 0 || tieneComprobante)
    throw new ConflictException(
      'La orden tiene facturación emitida, preparada o en proceso. Revisá los comprobantes antes de cambiar su precio.',
    );
}

export function validarTotalCobrado(total: number, cobrado: unknown) {
  if (total + 0.005 < numero(cobrado))
    throw new ConflictException(
      'El descuento dejaría el total por debajo de lo cobrado. Resolvé primero la diferencia en los cobros; no se modificó la orden.',
    );
}
